export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, handleRouteError } from "@/lib/validation/api";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(req: NextRequest) {
  try {
    // SSO is a Phase 2 feature — not yet implemented
    return apiError("NOT_IMPLEMENTED", "SSO authentication is not yet available. This feature is planned for Phase 2.", 501);

    // TODO: Implement SSO authorization flow after SsoConfiguration model is added to schema
    /*
    const orgId = req.nextUrl.searchParams.get("orgId");
    const provider = req.nextUrl.searchParams.get("provider"); // okta, azure_ad, google_workspace, generic_oidc, saml

    if (!orgId || !provider) {
      return apiError("INVALID_PARAMS", "orgId and provider are required", 400);
    }

    // Fetch SSO configuration
    const ssoConfig = await prisma.ssoConfiguration.findUnique({
      where: { organizationId: orgId },
    });*/

    // if (!ssoConfig || !ssoConfig.enabled) {
    //   return apiError("SSO_NOT_ENABLED", "SSO is not enabled for this organization", 403);
    // }
    //
    // // Build authorization URL based on provider
    // let authUrl: string;
    // const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/sso/callback`;
    //
    // switch (provider) {
    //   case "okta":
    //     // Use metadataUrl to construct authorization endpoint
    //     authUrl = buildOktaAuthUrl(ssoConfig, redirectUri);
    //     break;
    //   case "azure_ad":
    //     authUrl = buildAzureAdAuthUrl(ssoConfig, redirectUri);
    //     break;
    //   case "google_workspace":
    //     authUrl = buildGoogleWorkspaceAuthUrl(ssoConfig, redirectUri);
    //     break;
    //   case "generic_oidc":
    //     authUrl = buildOidcAuthUrl(ssoConfig, redirectUri);
    //     break;
    //   default:
    //     return apiError("INVALID_PROVIDER", "Unsupported SSO provider", 400);
    // }
    //
    // const response = NextResponse.json({ authUrl, stateToken: generateRandomState() });
    //
    // // Store state, org, and provider in secure cookies for callback verification
    // const state = generateRandomState();
    // response.cookies.set("sso_state", state, {
    //   httpOnly: true,
    //   secure: process.env.NODE_ENV === "production",
    //   sameSite: "lax",
    //   maxAge: 600, // 10 minutes
    // });
    // response.cookies.set("sso_org_id", orgId, {
    //   httpOnly: true,
    //   secure: process.env.NODE_ENV === "production",
    //   sameSite: "lax",
    //   maxAge: 600,
    // });
    // response.cookies.set("sso_provider", provider, {
    //   httpOnly: true,
    //   secure: process.env.NODE_ENV === "production",
    //   sameSite: "lax",
    //   maxAge: 600,
    // });
    //
    // return response;
  } catch (err) {
    return handleRouteError(err);
  }
}

function buildOktaAuthUrl(config: any, redirectUri: string): string {
  const clientId = config.clientId;
  const scope = "openid profile email";
  return `https://${extractOktaDomain(config.metadataUrl)}/oauth2/v1/authorize?client_id=${clientId}&response_type=code&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${generateRandomState()}`;
}

function buildAzureAdAuthUrl(config: any, redirectUri: string): string {
  const clientId = config.clientId;
  const scope = "openid profile email";
  const tenantId = extractAzureTenantId(config.metadataUrl);
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${generateRandomState()}`;
}

function buildGoogleWorkspaceAuthUrl(config: any, redirectUri: string): string {
  const clientId = config.clientId;
  const scope = "openid profile email";
  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&response_type=code&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${generateRandomState()}`;
}

function buildOidcAuthUrl(config: any, redirectUri: string): string {
  const clientId = config.clientId;
  const scope = "openid profile email";
  const metadataUrl = config.metadataUrl;
  const baseUrl = metadataUrl.replace("/.well-known/openid-configuration", "");
  return `${baseUrl}/oauth2/authorize?client_id=${clientId}&response_type=code&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${generateRandomState()}`;
}

function extractOktaDomain(metadataUrl: string): string {
  const match = metadataUrl.match(/https:\/\/([^/]+)/);
  return match ? match[1] : "okta.com";
}

function extractAzureTenantId(metadataUrl: string): string {
  const match = metadataUrl.match(/\/([a-f0-9-]+)\//);
  return match ? match[1] : "common";
}

function generateRandomState(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
