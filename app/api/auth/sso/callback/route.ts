export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";

// OAuth2/OIDC callback handler — receives authorization code from IdP
export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code");
    const state = req.nextUrl.searchParams.get("state");
    const error = req.nextUrl.searchParams.get("error");
    const errorDescription = req.nextUrl.searchParams.get("error_description");

    // Check for OAuth errors from IdP
    if (error) {
      console.error(`[sso-callback] OAuth error from IdP: ${error} - ${errorDescription}`);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/sso-error?error=${encodeURIComponent(error)}`,
      );
    }

    if (!code || !state) {
      return apiError("INVALID_REQUEST", "Missing code or state parameter", 400);
    }

    // Verify state from secure cookie
    const cookieState = req.cookies.get("sso_state")?.value;
    const orgId = req.cookies.get("sso_org_id")?.value;
    const provider = req.cookies.get("sso_provider")?.value;

    if (!cookieState || cookieState !== state) {
      return apiError("STATE_MISMATCH", "Invalid state parameter (CSRF protection)", 403);
    }

    if (!orgId || !provider) {
      return apiError("MISSING_SESSION", "Missing organization or provider info", 403);
    }

    // Fetch SSO configuration
    const ssoConfig = await prisma.ssoConfiguration.findUnique({
      where: { organizationId: orgId },
    });

    if (!ssoConfig || !ssoConfig.enabled) {
      return apiError("SSO_NOT_ENABLED", "SSO is not enabled for this organization", 403);
    }

    // Exchange authorization code for access token
    const tokenResponse = await exchangeCodeForToken(code, provider, ssoConfig);
    if (!tokenResponse.success) {
      console.error(`[sso-callback] Token exchange failed: ${tokenResponse.error}`);
      return apiError("TOKEN_EXCHANGE_FAILED", "Failed to exchange authorization code", 403);
    }

    // Verify ID token and extract user claims
    if (!tokenResponse.idToken) {
      console.error("[sso-callback] No ID token in token response");
      return apiError("INVALID_CLAIMS", "No ID token received from provider", 403);
    }

    const claims = await verifyAndExtractClaims(tokenResponse.idToken, provider, ssoConfig);
    if (!claims || !claims.email) {
      console.error("[sso-callback] Failed to extract claims from ID token");
      return apiError("INVALID_CLAIMS", "Failed to validate identity token", 403);
    }

    // Find or create user in the organization
    let user = await prisma.user.findUnique({ where: { email: claims.email } });

    if (!user) {
      // Auto-create user if enabled
      if (!ssoConfig.autoCreateUsers) {
        return apiError("USER_NOT_FOUND", "User not found and auto-creation is disabled", 403);
      }

      user = await prisma.user.create({
        data: {
          email: claims.email,
          name: claims.name || claims.email.split("@")[0],
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      });
    }

    // Verify user is member of the organization or create membership
    let membership = await prisma.organizationMembership.findFirst({
      where: { organizationId: orgId, userId: user.id },
    });

    if (!membership) {
      if (!ssoConfig.autoCreateUsers) {
        return apiError(
          "NOT_MEMBER",
          "User is not a member of this organization",
          403,
        );
      }

      // Auto-create membership with configured role
      const roleValue = ssoConfig.autoAssignRole || "viewer";
      membership = await prisma.organizationMembership.create({
        data: {
          organizationId: orgId,
          userId: user.id,
          role: roleValue as import("@prisma/client").OrgRole,
        },
      });
    }

    // Create SSO session record for audit trail
    await prisma.ssoSession.create({
      data: {
        organizationId: orgId,
        userId: user.id,
        provider,
        providerUserId: claims.sub,
        idpSessionId: tokenResponse.sessionId,
        accessToken: tokenResponse.accessToken,
        refreshToken: tokenResponse.refreshToken,
        tokenExpiresAt: tokenResponse.expiresAt,
      },
    });

    // Log SSO login
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: user.id,
      action: "auth.sso_login",
      resourceType: "sso_session",
      resourceId: user.id,
      metadata: {
        provider,
        email: claims.email,
        autoCreated: !membership,
      },
    });

    // Create a Better Auth session for the user
    // NOTE: In production, this would integrate with Better Auth to create a proper session cookie
    // For now, redirect to a session establishment endpoint or login flow
    const sessionUrl = new URL(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/sso-session`,
    );
    sessionUrl.searchParams.set("userId", user.id);
    sessionUrl.searchParams.set("orgId", orgId);

    const response = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/orgs/${orgId}/dashboard`,
    );

    // Clear SSO cookies
    response.cookies.delete("sso_state");
    response.cookies.delete("sso_org_id");
    response.cookies.delete("sso_provider");

    return response;
  } catch (err) {
    return handleRouteError(err);
  }
}

// Exchange authorization code for access token
async function exchangeCodeForToken(
  code: string,
  provider: string,
  config: any,
): Promise<{
  success: boolean;
  error?: string;
  accessToken?: string;
  idToken?: string;
  refreshToken?: string;
  sessionId?: string;
  expiresAt?: Date;
}> {
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/sso/callback`;

  try {
    let tokenEndpoint = "";
    let body = {};

    if (provider === "okta") {
      const domain = extractOktaDomain(config.metadataUrl);
      tokenEndpoint = `https://${domain}/oauth2/v1/token`;
      body = {
        grant_type: "authorization_code",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: redirectUri,
      };
    } else if (provider === "azure_ad") {
      const tenantId = extractAzureTenantId(config.metadataUrl);
      tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      body = {
        grant_type: "authorization_code",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: redirectUri,
        scope: "openid profile email",
      };
    } else if (provider === "google_workspace") {
      tokenEndpoint = "https://oauth2.googleapis.com/token";
      body = {
        grant_type: "authorization_code",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: redirectUri,
      };
    } else if (provider === "generic_oidc") {
      const baseUrl = config.metadataUrl.replace("/.well-known/openid-configuration", "");
      tokenEndpoint = `${baseUrl}/oauth2/token`;
      body = {
        grant_type: "authorization_code",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: redirectUri,
      };
    } else {
      return { success: false, error: "Unsupported provider" };
    }

    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body as Record<string, string>).toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[sso-callback] Token endpoint error: ${response.status} - ${text}`);
      return { success: false, error: `HTTP ${response.status}` };
    }

    const tokenData = await response.json();

    return {
      success: true,
      accessToken: tokenData.access_token,
      idToken: tokenData.id_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : undefined,
    };
  } catch (err) {
    console.error(`[sso-callback] Token exchange exception: ${err}`);
    return { success: false, error: String(err) };
  }
}

// Verify and extract claims from ID token (simplified — real implementation should validate JWS signature)
async function verifyAndExtractClaims(
  idToken: string,
  provider: string,
  config: any,
): Promise<{
  sub: string;
  email: string;
  name?: string;
} | null> {
  try {
    // Decode JWT (without verification for now — should verify signature in production)
    const parts = idToken.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());

    return {
      sub: payload.sub,
      email: payload.email || payload.preferred_username,
      name: payload.name || payload.given_name,
    };
  } catch (err) {
    console.error(`[sso-callback] JWT decode error: ${err}`);
    return null;
  }
}

function extractOktaDomain(metadataUrl: string): string {
  const match = metadataUrl.match(/https:\/\/([^/]+)/);
  return match ? match[1] : "okta.com";
}

function extractAzureTenantId(metadataUrl: string): string {
  const match = metadataUrl.match(/\/([a-f0-9-]+)\//);
  return match ? match[1] : "common";
}
