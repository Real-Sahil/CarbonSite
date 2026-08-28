export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, handleRouteError } from "@/lib/validation/api";
import {
  getSsoConfiguration,
  exchangeOidcCodeForToken,
  verifyOidcIdToken,
  fetchOidcUserInfo,
  validateSsoState,
  recordSsoSession,
  inferOidcEndpoint,
} from "@/lib/auth/sso-handler";

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code");
    const stateFromUrl = req.nextUrl.searchParams.get("state");
    const error = req.nextUrl.searchParams.get("error");
    const errorDescription = req.nextUrl.searchParams.get("error_description");

    // Handle OAuth provider errors
    if (error) {
      return apiError(
        "SSO_ERROR",
        `SSO provider error: ${error}. ${errorDescription || ""}`,
        400
      );
    }

    if (!code || !stateFromUrl) {
      return apiError(
        "INVALID_CALLBACK",
        "Authorization code and state are required",
        400
      );
    }

    // Extract state from cookie
    const stateFromCookie = req.cookies.get("sso_state")?.value;
    const orgIdFromCookie = req.cookies.get("sso_org_id")?.value;
    const providerFromCookie = req.cookies.get("sso_provider")?.value;
    const codeVerifierFromCookie = req.cookies.get("sso_code_verifier")?.value;

    if (!stateFromCookie || !orgIdFromCookie || !providerFromCookie || !codeVerifierFromCookie) {
      return apiError(
        "MISSING_STATE",
        "SSO session state not found. Please restart the SSO flow.",
        400
      );
    }

    // Validate state to prevent CSRF attacks
    try {
      if (!validateSsoState(stateFromCookie, stateFromUrl)) {
        return apiError("STATE_MISMATCH", "State validation failed. CSRF attack detected.", 403);
      }
    } catch {
      return apiError("STATE_VALIDATION_ERROR", "Failed to validate state", 400);
    }

    // Fetch SSO configuration
    const ssoConfig = await getSsoConfiguration(orgIdFromCookie);

    if (!ssoConfig || !ssoConfig.enabled) {
      return apiError("SSO_NOT_ENABLED", "SSO is not enabled for this organization", 403);
    }

    // Exchange authorization code for tokens
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/sso/callback`;

    const tokenResponse = await exchangeOidcCodeForToken(
      {
        clientId: ssoConfig.clientId,
        clientSecret: ssoConfig.clientSecret,
        redirectUri,
        issuer: ssoConfig.metadataUrl?.replace("/.well-known/openid-configuration", "") || "",
        authorizationEndpoint: inferOidcEndpoint(ssoConfig.metadataUrl || "", "authorization_endpoint"),
        tokenEndpoint: inferOidcEndpoint(ssoConfig.metadataUrl || "", "token_endpoint"),
        userinfoEndpoint: inferOidcEndpoint(ssoConfig.metadataUrl || "", "userinfo_endpoint"),
        jwksUri: inferOidcEndpoint(ssoConfig.metadataUrl || "", "jwks_uri"),
      },
      code,
      redirectUri,
      codeVerifierFromCookie
    );

    // Verify ID token
    const idTokenPayload = await verifyOidcIdToken(
      {
        clientId: ssoConfig.clientId,
        clientSecret: ssoConfig.clientSecret,
        redirectUri,
        issuer: ssoConfig.metadataUrl?.replace("/.well-known/openid-configuration", "") || "",
        authorizationEndpoint: "",
        tokenEndpoint: "",
        userinfoEndpoint: "",
        jwksUri: "",
      },
      tokenResponse.idToken || "",
      ssoConfig.clientId
    );

    // Fetch user info from OIDC provider
    const userInfo = await fetchOidcUserInfo(
      {
        clientId: ssoConfig.clientId,
        clientSecret: ssoConfig.clientSecret,
        redirectUri,
        issuer: "",
        authorizationEndpoint: "",
        tokenEndpoint: "",
        userinfoEndpoint: inferOidcEndpoint(ssoConfig.metadataUrl || "", "userinfo_endpoint"),
        jwksUri: "",
      },
      tokenResponse.accessToken
    );

    const providerUserId = userInfo.sub || idTokenPayload.sub;
    const email = userInfo.email || idTokenPayload.email;
    const name = userInfo.name || idTokenPayload.name;

    if (!providerUserId || !email) {
      return apiError(
        "MISSING_USER_INFO",
        "SSO provider did not return required user information (sub, email)",
        400
      );
    }

    // Find or create user in Better Auth
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      if (!ssoConfig.autoCreateUsers) {
        return apiError(
          "USER_NOT_FOUND",
          "User does not exist. Please contact your organization administrator.",
          403
        );
      }

      // Auto-create user if enabled
      user = await prisma.user.create({
        data: {
          email,
          name: name || email.split("@")[0],
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      });
    }

    // Link SSO account if not already linked
    const existingAccount = await prisma.account.findFirst({
      where: {
        userId: user.id,
        providerId: providerFromCookie,
      },
    });

    if (!existingAccount) {
      await prisma.account.create({
        data: {
          userId: user.id,
          accountId: providerUserId,
          providerId: providerFromCookie,
        },
      });
    }

    // Create organization membership record if user is not already a member
    const orgMembership = await prisma.organizationMembership.findFirst({
      where: {
        userId: user.id,
        organizationId: orgIdFromCookie,
      },
    });

    if (!orgMembership) {
      if (!ssoConfig.autoAssignRole) {
        return apiError(
          "NOT_ORG_MEMBER",
          "Your SSO account is not associated with this organization. Please contact your administrator.",
          403
        );
      }

      // Auto-assign role if enabled
      const roleToAssign = ssoConfig.autoAssignRole as "admin" | "editor" | "reviewer" | "viewer" | "auditor" | "field_worker" || "viewer";
      await prisma.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: orgIdFromCookie,
          role: roleToAssign,
        },
      });
    }

    // Record SSO session
    await recordSsoSession(
      orgIdFromCookie,
      user.id,
      providerFromCookie,
      providerUserId,
      tokenResponse.accessToken,
      tokenResponse.refreshToken,
      undefined, // Session ID if available from IdP
      tokenResponse.expiresIn ? new Date(Date.now() + tokenResponse.expiresIn * 1000) : undefined
    );

    // Create Better Auth session for the user
    const session = await prisma.session.create({
      data: {
        id: generateSessionId(),
        userId: user.id,
        token: generateSessionToken(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined,
        userAgent: req.headers.get("user-agent") || undefined,
      },
    });

    // Create response and clear temporary cookies
    const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/orgs/${orgIdFromCookie}/dashboard`;
    const response = NextResponse.redirect(dashboardUrl);

    // Set session cookie
    response.cookies.set("better-auth.session_token", session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    // Clear SSO cookies
    response.cookies.delete("sso_state");
    response.cookies.delete("sso_org_id");
    response.cookies.delete("sso_provider");
    response.cookies.delete("sso_code_verifier");

    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}

function generateSessionId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 24; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function generateSessionToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
