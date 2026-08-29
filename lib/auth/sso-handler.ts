import { prisma } from "@/lib/db";
import crypto from "crypto";
import { base64url } from "rfc4648";

export interface OidcConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint: string;
  jwksUri: string;
  metadataUrl?: string;
}

export interface SamlConfig {
  entityId: string;
  assertionConsumerServiceUrl: string;
  identityProviderUrl: string;
  certificate: string;
}

export async function getSsoConfiguration(organizationId: string) {
  return prisma.ssoConfiguration.findUnique({
    where: { organizationId },
  });
}

export function generateState(): string {
  return base64url.stringify(crypto.randomBytes(32));
}

export function generateCodeChallenge(codeVerifier: string): string {
  const hash = crypto.createHash("sha256").update(codeVerifier).digest();
  return base64url.stringify(hash);
}

export function generateCodeVerifier(): string {
  return base64url.stringify(crypto.randomBytes(32));
}

export async function buildOidcAuthorizationUrl(
  config: OidcConfig,
  redirectUri: string,
  state: string,
  codeChallenge?: string
): Promise<string> {
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    scope: "openid profile email",
    redirect_uri: redirectUri,
    state: state,
  });

  if (codeChallenge) {
    params.append("code_challenge", codeChallenge);
    params.append("code_challenge_method", "S256");
  }

  // Try to infer authorization endpoint from metadata if not provided
  let authEndpoint = config.authorizationEndpoint;
  if (!authEndpoint && config.metadataUrl) {
    authEndpoint = inferOidcEndpoint(config.metadataUrl, "authorization_endpoint");
  }

  return `${authEndpoint}?${params.toString()}`;
}

export async function exchangeOidcCodeForToken(
  config: OidcConfig,
  code: string,
  redirectUri: string,
  codeVerifier?: string
): Promise<{ accessToken: string; idToken?: string; expiresIn?: number; refreshToken?: string }> {
  const tokenEndpoint = config.tokenEndpoint || (config.metadataUrl ? inferOidcEndpoint(config.metadataUrl, "token_endpoint") : "");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: code,
    redirect_uri: redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  if (codeVerifier) {
    body.append("code_verifier", codeVerifier);
  }

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OIDC token exchange failed: ${response.statusText} - ${error}`);
  }

  return response.json();
}

export async function verifyOidcIdToken(
  config: OidcConfig,
  idToken: string,
  clientId: string
): Promise<Record<string, unknown>> {
  // In production, verify JWT signature using JWKS
  // For MVP, decode without verification (insecure - only for development)
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT verification not yet implemented for production");
  }

  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }

  const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());

  // Basic validation
  if (payload.aud !== clientId) {
    throw new Error("Invalid audience in ID token");
  }

  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("ID token expired");
  }

  return payload;
}

export async function fetchOidcUserInfo(
  config: OidcConfig,
  accessToken: string
): Promise<{ sub: string; email: string; name?: string; picture?: string }> {
  const userInfoEndpoint =
    config.userinfoEndpoint || (config.metadataUrl ? inferOidcEndpoint(config.metadataUrl, "userinfo_endpoint") : "");

  const response = await fetch(userInfoEndpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch OIDC user info: ${response.statusText}`);
  }

  return response.json();
}

export function inferOidcEndpoint(metadataUrl: string, endpoint: "authorization_endpoint" | "token_endpoint" | "userinfo_endpoint" | "jwks_uri"): string {
  // Extract base URL from metadata URL
  const baseUrl = metadataUrl.replace("/.well-known/openid-configuration", "");

  switch (endpoint) {
    case "authorization_endpoint":
      return `${baseUrl}/oauth2/authorize`;
    case "token_endpoint":
      return `${baseUrl}/oauth2/token`;
    case "userinfo_endpoint":
      return `${baseUrl}/oauth2/userinfo`;
    case "jwks_uri":
      return `${baseUrl}/oauth2/certs`;
    default:
      return baseUrl;
  }
}

export async function recordSsoSession(
  organizationId: string,
  userId: string,
  provider: string,
  providerUserId: string,
  accessToken?: string,
  refreshToken?: string,
  idpSessionId?: string,
  tokenExpiresAt?: Date
) {
  return prisma.ssoSession.upsert({
    where: {
      organizationId_providerUserId: {
        organizationId,
        providerUserId,
      },
    },
    update: {
      userId,
      accessToken,
      refreshToken,
      tokenExpiresAt,
      idpSessionId,
      lastActivityAt: new Date(),
    },
    create: {
      organizationId,
      userId,
      provider,
      providerUserId,
      accessToken,
      refreshToken,
      idpSessionId,
      tokenExpiresAt,
    },
  });
}

export function validateSsoState(stateFromCookie: string, stateFromUrl: string): boolean {
  if (!stateFromCookie || !stateFromUrl) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(stateFromCookie), Buffer.from(stateFromUrl));
}
