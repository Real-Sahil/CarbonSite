export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { apiError, handleRouteError } from "@/lib/validation/api";
import {
  getSsoConfiguration,
  generateState,
  generateCodeVerifier,
  buildOidcAuthorizationUrl,
  buildSamlAuthenticationRequest,
  inferOidcEndpoint,
} from "@/lib/auth/sso-handler";

// Identifies this application to every IdP configured across every
// organization's SAML integration — one value for the whole app, not
// per-org (the org itself is identified by the RelayState this route sets,
// and by whichever SsoConfiguration's certificate ends up verifying the
// response). This is the value an org's IdP admin enters as this app's
// "Service Provider Entity ID" when setting up SAML.
const SAML_SP_ENTITY_ID = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/sso/saml/metadata`;

export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("orgId");
    const provider = req.nextUrl.searchParams.get("provider"); // okta, azure_ad, google_workspace, generic_oidc, saml

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

    if (provider === "saml") {
      if (!ssoConfig.ssoUrl) {
        return apiError("INVALID_SAML_CONFIG", "This organization's SAML configuration is missing an SSO URL.", 400);
      }

      const assertionConsumerServiceUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/sso/callback`;
      const { id: requestId, encodedRequest } = buildSamlAuthenticationRequest({
        entityId: SAML_SP_ENTITY_ID,
        assertionConsumerServiceUrl,
        identityProviderUrl: ssoConfig.ssoUrl,
        certificate: ssoConfig.certificateX509 || "",
      });

      // SP-initiated: the browser POSTs SAMLRequest to the IdP itself
      // (HTTP-POST binding), so the response here is form fields for the
      // client to auto-submit, not a redirect URL.
      const response = NextResponse.json({
        redirectMethod: "POST",
        url: ssoConfig.ssoUrl,
        formFields: { SAMLRequest: encodedRequest },
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
      response.cookies.set("sso_saml_request_id", requestId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 600,
      });

      return response;
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
    const response = NextResponse.json({ redirectMethod: "GET", url: authUrl });

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
