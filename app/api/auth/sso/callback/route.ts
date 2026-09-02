export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { SsoConfiguration } from "@prisma/client";
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
  extractSamlUserInfo,
} from "@/lib/auth/sso-handler";

interface UserInfo {
  providerUserId: string;
  email: string;
  name?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
}

async function handleOidcCallback(
  code: string,
  stateFromUrl: string,
  stateFromCookie: string,
  codeVerifierFromCookie: string,
  ssoConfig: SsoConfiguration
): Promise<UserInfo> {
  // Validate state to prevent CSRF attacks
  if (!validateSsoState(stateFromCookie, stateFromUrl)) {
    throw new Error("STATE_MISMATCH: State validation failed. CSRF attack detected.");
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

  const providerUserId = (userInfo.sub || idTokenPayload.sub) as string;
  const email = (userInfo.email || idTokenPayload.email) as string;
  const name = (userInfo.name || idTokenPayload.name) as string | undefined;

  if (!providerUserId || !email) {
    throw new Error("MISSING_USER_INFO: SSO provider did not return required user information (sub, email)");
  }

  return {
    providerUserId,
    email,
    name,
    accessToken: tokenResponse.accessToken,
    refreshToken: tokenResponse.refreshToken,
    expiresIn: tokenResponse.expiresIn
  };
}

async function handleSamlCallback(
  samlResponse: string,
  ssoConfig: SsoConfiguration
): Promise<UserInfo> {
  const userInfo = await extractSamlUserInfo(samlResponse, ssoConfig.certificateX509 || "");

  const providerUserId = userInfo.sub;
  const email = userInfo.email;
  const name = userInfo.name;

  if (!providerUserId || !email) {
    throw new Error("MISSING_USER_INFO: SAML provider did not return required user information (sub, email)");
  }

  return { providerUserId, email, name };
}

async function createOrUpdateUserAndSession(
  req: NextRequest,
  userInfo: UserInfo,
  orgIdFromCookie: string,
  providerFromCookie: string,
  ssoConfig: SsoConfiguration
): Promise<NextResponse> {
  // Find or create user in Better Auth
  let user = await prisma.user.findUnique({
    where: { email: userInfo.email },
  });

  if (!user) {
    if (!ssoConfig.autoCreateUsers) {
      throw new Error("USER_NOT_FOUND: User does not exist. Please contact your organization administrator.");
    }

    // Auto-create user if enabled
    user = await prisma.user.create({
      data: {
        email: userInfo.email,
        name: userInfo.name || userInfo.email.split("@")[0],
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
        accountId: userInfo.providerUserId,
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
      throw new Error("NOT_ORG_MEMBER: Your SSO account is not associated with this organization. Please contact your administrator.");
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

  // Record SSO session (OIDC includes tokens; SAML may not)
  await recordSsoSession(
    orgIdFromCookie,
    user.id,
    providerFromCookie,
    userInfo.providerUserId,
    userInfo.accessToken,
    userInfo.refreshToken,
    undefined,
    userInfo.expiresIn ? new Date(Date.now() + userInfo.expiresIn * 1000) : undefined
  );

  // Create Better Auth session for the user
  const session = await prisma.session.create({
    data: {
      id: generateSessionId(),
      userId: user.id,
      token: generateSessionToken(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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
    maxAge: 7 * 24 * 60 * 60,
  });

  // Clear SSO cookies
  response.cookies.delete("sso_state");
  response.cookies.delete("sso_org_id");
  response.cookies.delete("sso_provider");
  response.cookies.delete("sso_code_verifier");

  return response;
}

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

    // Fetch SSO configuration
    const ssoConfig = await getSsoConfiguration(orgIdFromCookie);

    if (!ssoConfig || !ssoConfig.enabled) {
      return apiError("SSO_NOT_ENABLED", "SSO is not enabled for this organization", 403);
    }

    // Handle OIDC callback
    const userInfo = await handleOidcCallback(
      code,
      stateFromUrl,
      stateFromCookie,
      codeVerifierFromCookie,
      ssoConfig
    );

    return createOrUpdateUserAndSession(
      req,
      userInfo,
      orgIdFromCookie,
      providerFromCookie,
      ssoConfig
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    // SAML callbacks come as POST requests with SAMLResponse in the body
    const body = await req.formData().catch(() => new FormData());
    const samlResponse = body.get("SAMLResponse") as string | null;

    if (!samlResponse) {
      return apiError(
        "INVALID_SAML_RESPONSE",
        "SAMLResponse parameter is required",
        400
      );
    }

    // Extract org ID and provider from cookies
    const orgIdFromCookie = req.cookies.get("sso_org_id")?.value;
    const providerFromCookie = req.cookies.get("sso_provider")?.value;

    if (!orgIdFromCookie || !providerFromCookie) {
      return apiError(
        "MISSING_STATE",
        "SSO session state not found. Please restart the SSO flow.",
        400
      );
    }

    // Fetch SSO configuration
    const ssoConfig = await getSsoConfiguration(orgIdFromCookie);

    if (!ssoConfig || !ssoConfig.enabled) {
      return apiError("SSO_NOT_ENABLED", "SSO is not enabled for this organization", 403);
    }

    // Handle SAML callback
    const userInfo = await handleSamlCallback(samlResponse, ssoConfig);

    return createOrUpdateUserAndSession(
      req,
      userInfo,
      orgIdFromCookie,
      providerFromCookie,
      ssoConfig
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

function generateSessionId(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

function generateSessionToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}
