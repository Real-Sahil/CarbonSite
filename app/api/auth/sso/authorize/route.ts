export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { apiError, handleRouteError } from "@/lib/validation/api";
import {
  getSsoConfiguration,
  generateState,
  generateCodeVerifier,
  buildOidcAuthorizationUrl,
  inferOidcEndpoint,
} from "@/lib/auth/sso-handler";

export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("orgId");
    const provider = req.nextUrl.searchParams.get("provider"); // okta, azure_ad, google_workspace, generic_oidc

    if (!orgId || !provider) {
      return apiError("INVALID_PARAMS", "orgId and provider are required", 400);
    }

    // Fetch SSO configuration
    const ssoConfig = await getSsoConfiguration(orgId);

    if (!ssoConfig || !ssoConfig.enabled) {
      return apiError("SSO_NOT_ENABLED", "SSO is not enabled for this organization", 403);
    }

    // Validate provider matches configuration
    if (ssoConfig.provider !== provider) {
      return apiError("PROVIDER_MISMATCH", "Provider does not match organization configuration", 400);
    }

    // Build authorization URL
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/sso/callback`;
    const state = generateState();
    const codeVerifier = generateCodeVerifier();

    const authUrl = await buildOidcAuthorizationUrl(
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
      redirectUri,
      state,
      codeVerifier
    );

    // Create response and set secure cookies
    const response = NextResponse.json({ authUrl });

    response.cookies.set("sso_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
    });

    response.cookies.set("sso_org_id", orgId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
    });

    response.cookies.set("sso_provider", provider, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
    });

    response.cookies.set("sso_code_verifier", codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
    });

    return response;
  } catch (err) {
    return handleRouteError(err);
  }
}
