import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { encryptCredential, decryptCredential } from "@/lib/integrations/encryption";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const configUpdateSchema = z.object({
  llmProvider: z.enum(["huggingface", "nvidia"]).optional(),
  llmToken: z.string().min(1).optional(),
  xeroClientId: z.string().optional(),
  xeroClientSecret: z.string().optional(),
  quickbooksClientId: z.string().optional(),
  quickbooksClientSecret: z.string().optional(),
  sageClientId: z.string().optional(),
  sageClientSecret: z.string().optional(),
  oidcProvider: z.enum(["google", "okta", "azure", "generic"]).optional(),
  oidcClientId: z.string().optional(),
  oidcClientSecret: z.string().optional(),
  oidcIssuerUrl: z.string().url().optional(),
  n8nWebhookReports: z.string().url().optional(),
  n8nWebhookSubmissions: z.string().url().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const config = await prisma.integrationConfig.findUnique({
      where: { organizationId: orgId },
    });

    if (!config) {
      return NextResponse.json(
        {
          llmProvider: null,
          xeroConnected: false,
          quickbooksConnected: false,
          sageConnected: false,
          oidcProvider: null,
          testResults: null,
        },
        { status: 200 }
      );
    }

    // Don't send encrypted tokens to frontend
    return NextResponse.json(
      {
        llmProvider: config.llmProvider,
        llmTokenValid: config.llmTokenValid,
        xeroConnected: config.xeroConnected,
        xeroClientId: config.xeroClientId,
        quickbooksConnected: config.quickbooksConnected,
        quickbooksClientId: config.quickbooksClientId,
        sageConnected: config.sageConnected,
        sageClientId: config.sageClientId,
        oidcProvider: config.oidcProvider,
        oidcClientId: config.oidcClientId,
        oidcIssuerUrl: config.oidcIssuerUrl,
        n8nWebhookReportsTested: config.n8nWebhookReportsTested,
        n8nWebhookSubmissionsTested: config.n8nWebhookSubmissionsTested,
        testResults: config.testResults,
        lastTestedAt: config.lastTestedAt,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching integration config:", error);
    return NextResponse.json(
      { message: "Failed to fetch integration configuration" },
      { status: 500 }
    );
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
    const validated = configUpdateSchema.parse(body);

    // Get or create config
    let config = await prisma.integrationConfig.findUnique({
      where: { organizationId: orgId },
    });

    const updateData: Prisma.IntegrationConfigUpdateInput = {};

    // LLM
    if (validated.llmProvider) updateData.llmProvider = validated.llmProvider;
    if (validated.llmToken)
      updateData.llmToken = encryptCredential(validated.llmToken);

    // Xero
    if (validated.xeroClientId) updateData.xeroClientId = validated.xeroClientId;
    if (validated.xeroClientSecret)
      updateData.xeroClientSecret = encryptCredential(validated.xeroClientSecret);

    // QuickBooks
    if (validated.quickbooksClientId) updateData.quickbooksClientId = validated.quickbooksClientId;
    if (validated.quickbooksClientSecret)
      updateData.quickbooksClientSecret = encryptCredential(validated.quickbooksClientSecret);

    // Sage
    if (validated.sageClientId) updateData.sageClientId = validated.sageClientId;
    if (validated.sageClientSecret)
      updateData.sageClientSecret = encryptCredential(validated.sageClientSecret);

    // OIDC
    if (validated.oidcProvider) updateData.oidcProvider = validated.oidcProvider;
    if (validated.oidcClientId) updateData.oidcClientId = validated.oidcClientId;
    if (validated.oidcClientSecret)
      updateData.oidcClientSecret = encryptCredential(validated.oidcClientSecret);
    if (validated.oidcIssuerUrl) updateData.oidcIssuerUrl = validated.oidcIssuerUrl;

    // n8n
    if (validated.n8nWebhookReports)
      updateData.n8nWebhookReports = encryptCredential(validated.n8nWebhookReports);
    if (validated.n8nWebhookSubmissions)
      updateData.n8nWebhookSubmissions = encryptCredential(
        validated.n8nWebhookSubmissions
      );

    if (config) {
      config = await prisma.integrationConfig.update({
        where: { organizationId: orgId },
        data: updateData,
      });
    } else {
      config = await prisma.integrationConfig.create({
        data: {
          organizationId: orgId,
          ...updateData,
        } as unknown as Prisma.IntegrationConfigUncheckedCreateInput,
      });
    }

    return NextResponse.json(
      { message: "Integration configuration updated" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating integration config:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid configuration", errors: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { message: "Failed to update integration configuration" },
      { status: 500 }
    );
  }
}
