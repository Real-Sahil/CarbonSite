export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";

type Params = { params: Promise<{ orgId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin");

    const config = await prisma.ssoConfiguration.findUnique({
      where: { organizationId: orgId },
    });

    if (!config) {
      return apiError("NOT_FOUND", "SSO configuration not found", 404);
    }

    // Test metadata endpoint based on provider
    const testResult = await testProviderConnection(config);

    return NextResponse.json({
      success: testResult.success,
      provider: config.provider,
      message: testResult.message,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

async function testProviderConnection(config: any): Promise<{ success: boolean; message: string }> {
  try {
    switch (config.provider) {
      case "okta":
      case "azure_ad":
      case "generic_oidc":
        if (!config.metadataUrl) {
          return { success: false, message: "Metadata URL not configured" };
        }
        const metadataResponse = await fetch(config.metadataUrl);
        if (!metadataResponse.ok) {
          return { success: false, message: `Metadata endpoint returned ${metadataResponse.status}` };
        }
        const metadata = await metadataResponse.json();
        if (!metadata.token_endpoint || !metadata.authorization_endpoint) {
          return { success: false, message: "Invalid metadata: missing required endpoints" };
        }
        return { success: true, message: "Metadata retrieved successfully" };

      case "google_workspace":
        // Google Workspace uses standard OAuth endpoints
        const googleMetadata = await fetch(
          "https://accounts.google.com/.well-known/openid-configuration"
        );
        if (!googleMetadata.ok) {
          return { success: false, message: "Failed to reach Google's metadata endpoint" };
        }
        return { success: true, message: "Google Workspace connection verified" };

      case "saml":
        if (!config.metadataUrl) {
          return { success: true, message: "SAML configured (metadata URL not used)" };
        }
        const samlMetadata = await fetch(config.metadataUrl);
        if (!samlMetadata.ok) {
          return { success: false, message: `SAML metadata endpoint returned ${samlMetadata.status}` };
        }
        return { success: true, message: "SAML metadata retrieved successfully" };

      default:
        return { success: false, message: "Unknown provider" };
    }
  } catch (error) {
    return {
      success: false,
      message: `Connection error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
