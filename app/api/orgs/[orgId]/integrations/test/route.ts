import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { decryptCredential } from "@/lib/integrations/encryption";
import { z } from "zod";

const testSchema = z.object({
  type: z.enum(["llm", "xero", "oidc", "n8n"]),
  webhookType: z.enum(["reports", "submissions"]).optional(),
});

async function testLLM(orgId: string, provider: string, token: string) {
  try {
    if (provider === "huggingface") {
      const response = await fetch(
        "https://api-inference.huggingface.co/models/google/flan-t5-base",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: "What is carbon accounting?",
          }),
        }
      );

      if (!response.ok) {
        return {
          status: "failed",
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return { status: "success" };
    } else if (provider === "nvidia") {
      const baseUrl = process.env.NVIDIA_NIM_BASE_URL || "https://integrate.api.nvidia.com/v1";
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "meta/llama2-70b-chat",
          messages: [{ role: "user", content: "What is carbon accounting?" }],
          max_tokens: 100,
        }),
      });

      if (!response.ok) {
        return {
          status: "failed",
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return { status: "success" };
    }

    return {
      status: "failed",
      error: `Unknown provider: ${provider}`,
    };
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function testXero(clientId: string, clientSecret: string) {
  try {
    // Test by attempting to exchange code (should fail without code, but proves credentials work)
    const response = await fetch("https://identity.xero.com/connect/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });

    // 400 is expected (no scope), but 401 means bad credentials
    if (response.status === 401) {
      return { status: "failed", error: "Invalid Xero credentials" };
    }

    return { status: "success" };
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function testOIDC(issuerUrl: string) {
  try {
    const response = await fetch(`${issuerUrl}/.well-known/openid-configuration`);

    if (!response.ok) {
      return {
        status: "failed",
        error: `OIDC discovery failed: HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    if (!data.issuer) {
      return {
        status: "failed",
        error: "Invalid OIDC configuration: missing issuer",
      };
    }

    return { status: "success" };
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function testN8n(webhookUrl: string) {
  try {
    // Test webhook by sending a health check payload
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "test",
        timestamp: new Date().toISOString(),
      }),
    });

    // n8n webhooks typically return 2xx on success
    if (!response.ok && response.status !== 429) {
      return {
        status: "failed",
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    return { status: "success" };
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const body = await req.json();
    const { type, webhookType } = testSchema.parse(body);

    const config = await prisma.integrationConfig.findUnique({
      where: { organizationId: orgId },
    });

    if (!config) {
      return NextResponse.json(
        { message: "No integration configuration found" },
        { status: 404 }
      );
    }

    let result: { status: string; error?: string } | undefined;

    switch (type) {
      case "llm": {
        if (!config.llmProvider || !config.llmToken) {
          return NextResponse.json(
            { message: "LLM not configured" },
            { status: 400 }
          );
        }
        result = await testLLM(
          orgId,
          config.llmProvider,
          decryptCredential(config.llmToken)
        );

        if (result.status === "success") {
          await prisma.integrationConfig.update({
            where: { organizationId: orgId },
            data: {
              llmTokenValid: true,
              llmTokenValidatedAt: new Date(),
              testResults: {
                ...(config.testResults as any),
                llm: result,
              },
              lastTestedAt: new Date(),
            },
          });
        }
        break;
      }

      case "xero": {
        if (!config.xeroClientId || !config.xeroClientSecret) {
          return NextResponse.json(
            { message: "Xero not configured" },
            { status: 400 }
          );
        }
        result = await testXero(
          config.xeroClientId,
          decryptCredential(config.xeroClientSecret)
        );

        if (result.status === "success") {
          await prisma.integrationConfig.update({
            where: { organizationId: orgId },
            data: {
              xeroConnected: true,
              xeroConnectedAt: new Date(),
              testResults: {
                ...(config.testResults as any),
                xero: result,
              },
              lastTestedAt: new Date(),
            },
          });
        }
        break;
      }

      case "oidc": {
        if (!config.oidcIssuerUrl) {
          return NextResponse.json(
            { message: "OIDC not configured" },
            { status: 400 }
          );
        }
        result = await testOIDC(config.oidcIssuerUrl);

        if (result.status === "success") {
          await prisma.integrationConfig.update({
            where: { organizationId: orgId },
            data: {
              oidcDiscoveryValid: true,
              oidcDiscoveryValidatedAt: new Date(),
              testResults: {
                ...(config.testResults as any),
                oidc: result,
              },
              lastTestedAt: new Date(),
            },
          });
        }
        break;
      }

      case "n8n": {
        const webhook =
          webhookType === "submissions"
            ? config.n8nWebhookSubmissions
            : config.n8nWebhookReports;

        if (!webhook) {
          return NextResponse.json(
            { message: `n8n ${webhookType} webhook not configured` },
            { status: 400 }
          );
        }

        result = await testN8n(decryptCredential(webhook));

        if (result.status === "success") {
          if (webhookType === "submissions") {
            await prisma.integrationConfig.update({
              where: { organizationId: orgId },
              data: {
                n8nWebhookSubmissionsTested: true,
                testResults: {
                  ...(config.testResults as any),
                  n8n_submissions: result,
                },
                lastTestedAt: new Date(),
              },
            });
          } else {
            await prisma.integrationConfig.update({
              where: { organizationId: orgId },
              data: {
                n8nWebhookReportsTested: true,
                testResults: {
                  ...(config.testResults as any),
                  n8n_reports: result,
                },
                lastTestedAt: new Date(),
              },
            });
          }
        }
        break;
      }
    }

    if (!result) {
      return NextResponse.json(
        { message: "Unknown test type" },
        { status: 400 }
      );
    }

    return NextResponse.json(result, {
      status: result.status === "success" ? 200 : 400,
    });
  } catch (error) {
    console.error("Error testing integration:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid request", errors: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { message: "Failed to test integration" },
      { status: 500 }
    );
  }
}
