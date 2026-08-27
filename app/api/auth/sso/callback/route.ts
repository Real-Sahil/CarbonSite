export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifySsoUser } from "@/lib/auth/sso-handler";
import { apiError, handleRouteError } from "@/lib/validation/api";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code");
    const state = req.nextUrl.searchParams.get("state");
    const error = req.nextUrl.searchParams.get("error");
    const errorDescription = req.nextUrl.searchParams.get("error_description");

    if (error) {
      return apiError(
        "SSO_ERROR",
        `Provider returned error: ${error}${errorDescription ? ` - ${errorDescription}` : ""}`,
        400
      );
    }

    if (!code || !state) {
      return apiError("INVALID_PARAMS", "code and state parameters are required", 400);
    }

    // Retrieve state from session to validate CSRF
    const storedState = req.cookies.get("sso_state")?.value;
    if (!storedState || storedState !== state) {
      return apiError("INVALID_STATE", "State parameter mismatch or expired", 403);
    }

    const orgId = req.cookies.get("sso_org_id")?.value;
    const provider = req.cookies.get("sso_provider")?.value;

    if (!orgId || !provider) {
      return apiError("INVALID_PARAMS", "Missing SSO context in cookies", 400);
    }

    // Fetch SSO configuration
    const ssoConfig = await prisma.ssoConfiguration.findUnique({
      where: { organizationId: orgId },
    });

    if (!ssoConfig || !ssoConfig.enabled) {
      return apiError("SSO_NOT_ENABLED", "SSO is not enabled for this organization", 403);
    }

    // Exchange code for tokens based on provider
    const tokenResponse = await exchangeCodeForToken(code, provider, ssoConfig);

    // Extract user info from token/response
    const userInfo = await extractUserInfo(tokenResponse, provider, ssoConfig);

    // Verify and provision user
    const ssoUserResult = await verifySsoUser({
      orgId,
      provider,
      userInfo,
      idToken: tokenResponse.id_token,
    });

    // Create session in database
    const sessionId = crypto.randomUUID();
    const session = await prisma.session.create({
      data: {
        id: sessionId,
        userId: ssoUserResult.userId,
        token: tokenResponse.access_token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        ipAddress: req.headers.get("x-forwarded-for") || undefined,
        userAgent: req.headers.get("user-agent") || undefined,
      },
    });

    // Build redirect to app with session info
    const redirect = new URL("/app", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
    redirect.searchParams.set("orgId", orgId);

    const response = NextResponse.redirect(redirect);

    // Set session cookie
    response.cookies.set("better-auth.session_token", session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
    });

    // Clear SSO cookies
    response.cookies.delete("sso_state");
    response.cookies.delete("sso_org_id");
    response.cookies.delete("sso_provider");

    return response;
  } catch (err) {
    return handleRouteError(err);
  }
}

async function exchangeCodeForToken(
  code: string,
  provider: string,
  config: any
): Promise<Record<string, any>> {
  const tokenEndpoint = getTokenEndpoint(provider, config);
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/sso/callback`;

  const tokenParams = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenParams.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return response.json();
}

function getTokenEndpoint(provider: string, config: any): string {
  switch (provider) {
    case "okta":
      const oktaDomain = extractDomainFromUrl(config.metadataUrl);
      return `https://${oktaDomain}/oauth2/v1/token`;

    case "azure_ad":
      const tenantId = extractTenantIdFromUrl(config.metadataUrl);
      return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

    case "google_workspace":
      return "https://oauth2.googleapis.com/token";

    case "generic_oidc":
      const baseUrl = config.metadataUrl.replace("/.well-known/openid-configuration", "");
      return `${baseUrl}/oauth2/token`;

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

async function extractUserInfo(
  tokenResponse: Record<string, any>,
  provider: string,
  config: any
): Promise<{
  email: string;
  name?: string;
  picture?: string;
  providerUserId: string;
}> {
  const idToken = tokenResponse.id_token;

  if (!idToken) {
    throw new Error("No ID token in response");
  }

  // Decode JWT (simple decode without verification for now)
  const claims = parseJwt(idToken);

  if (!claims.email) {
    throw new Error("No email in token claims");
  }

  return {
    email: claims.email,
    name: claims.name || claims.given_name,
    picture: claims.picture,
    providerUserId: claims.sub || claims.oid,
  };
}

function parseJwt(token: string): Record<string, any> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }

  const payload = parts[1];
  const decoded = Buffer.from(payload, "base64").toString("utf-8");

  return JSON.parse(decoded);
}

function extractDomainFromUrl(url: string): string {
  const match = url.match(/https:\/\/([^/]+)/);
  return match ? match[1] : "okta.com";
}

function extractTenantIdFromUrl(url: string): string {
  const match = url.match(/\/([a-f0-9-]+)\//);
  return match ? match[1] : "common";
}
