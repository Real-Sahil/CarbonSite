import { prisma } from "@/lib/db";
import crypto from "crypto";
import { base64url } from "rfc4648";
import { SignedXml } from "xml-crypto";
import { DOMParser } from "@xmldom/xmldom";
import * as xpath from "xpath";

const SAML_NAMESPACES = {
  samlp: "urn:oasis:names:tc:SAML:2.0:protocol",
  saml: "urn:oasis:names:tc:SAML:2.0:assertion",
  ds: "http://www.w3.org/2000/09/xmldsig#",
};
const selectSaml = xpath.useNamespaces(SAML_NAMESPACES);

function selectElements(expr: string, node: Node): Element[] {
  return (selectSaml(expr, node) as unknown[]).filter(
    (n): n is Element => typeof n === "object" && n !== null && "getAttribute" in n,
  );
}

function textOf(node: Element | undefined): string | undefined {
  return node?.textContent?.trim() || undefined;
}

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

export function buildSamlAuthenticationRequest(config: SamlConfig): string {
  const id = `_${crypto.randomBytes(16).toString("hex")}`;
  const issueInstant = new Date().toISOString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<samlp:AuthnRequest
  xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
  ID="${id}"
  Version="2.0"
  IssueInstant="${issueInstant}"
  Destination="${config.identityProviderUrl}"
  AssertionConsumerServiceURL="${config.assertionConsumerServiceUrl}"
  ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
  <saml:Issuer>${config.entityId}</saml:Issuer>
  <samlp:NameIDPolicy Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" AllowCreate="true"/>
  <samlp:RequestedAuthnContext Comparison="exact">
    <saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:Password</saml:AuthnContextClassRef>
  </samlp:RequestedAuthnContext>
</samlp:AuthnRequest>`;

  return Buffer.from(xml).toString("base64");
}

// SAML certificates are commonly stored as bare base64 (no PEM wrapper);
// idempotent either way.
function toPemCertificate(raw: string): string {
  const body = raw
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/[\r\n\s]+/g, "");
  const lines = body.match(/.{1,64}/g) ?? [];
  return `-----BEGIN CERTIFICATE-----\n${lines.join("\n")}\n-----END CERTIFICATE-----\n`;
}

// Verifies the SAML response's signature and returns the specific Assertion
// element it was checked against — never "a valid signature exists
// somewhere in this document", which is the XML Signature Wrapping (XSW)
// hole a regex-based check like the old one leaves wide open: an attacker
// can attach a genuinely-signed assertion (replayed from a real login) next
// to a forged, unsigned one, and a check that only asks "does *a* signature
// verify" will pass without ever confirming *which* assertion it covers.
//
// The document must contain exactly one Assertion (more than one is itself
// a wrapping-attack shape, so it's rejected rather than guessed at), and
// the accepted signature's own Reference must resolve — by that Assertion's
// own ID attribute, not by node identity across separately-parsed DOMs — to
// that exact element.
function verifySignedAssertion(doc: Document, xml: string, certificate: string): Element {
  const assertions = selectElements("//saml:Assertion", doc);
  if (assertions.length === 0) {
    throw new Error("SAML response contains no Assertion element.");
  }
  if (assertions.length > 1) {
    throw new Error(
      "SAML response contains multiple Assertion elements — rejecting as a possible signature-wrapping attempt.",
    );
  }
  const assertionEl = assertions[0];
  const assertionId = assertionEl.getAttribute("ID");
  if (!assertionId) {
    throw new Error("SAML Assertion has no ID attribute to bind its signature to.");
  }

  // The signature may be on the Assertion itself, or on the enclosing
  // Response (which, canonicalized over the whole document, covers the
  // Assertion too) — either is an acceptable place to find it.
  const signatureNodes = [
    ...selectElements("./ds:Signature", assertionEl),
    ...selectElements("/samlp:Response/ds:Signature", doc),
  ];
  if (signatureNodes.length === 0) {
    throw new Error("No signature found on the SAML Assertion or Response.");
  }

  const pemCert = toPemCertificate(certificate);

  for (const signatureNode of signatureNodes) {
    // "ID" is already one of xml-crypto's own default idAttributes
    // (["Id", "ID", "id"]) — passing it again here would prepend a
    // duplicate entry, making its own duplicate-ID safety check see every
    // real ID twice and refuse to validate anything.
    const sig = new SignedXml({ publicCert: pemCert });
    try {
      sig.loadSignature(signatureNode);
      if (!sig.checkSignature(xml)) continue;
    } catch {
      continue;
    }

    // `ref.signedReference` (set only once that reference's own digest has
    // been validated as part of the checkSignature() call above) is the
    // non-deprecated way to confirm THIS specific reference — by its own
    // Assertion ID, not merely "some signature in the document checked out"
    // — actually passed. (The alternative, ref.getValidatedNode(), re-
    // resolves the reference against a fresh parse and is flagged
    // deprecated-and-insecure by xml-crypto itself for exactly the
    // wrapping-attack reasons this whole function exists to close.)
    const coversAssertion = sig.getReferences().some(
      (ref) => ref.uri.replace(/^#/, "") === assertionId && ref.signedReference != null,
    );
    if (coversAssertion) return assertionEl;
  }

  throw new Error("SAML signature verification failed: no valid signature covers this Assertion.");
}

function checkAssertionConditions(assertionEl: Element): void {
  const conditions = selectElements("./saml:Conditions", assertionEl)[0];
  if (!conditions) return;

  const notBefore = conditions.getAttribute("NotBefore");
  const notOnOrAfter = conditions.getAttribute("NotOnOrAfter");
  const now = Date.now();
  const CLOCK_SKEW_MS = 60_000;

  if (notBefore && new Date(notBefore).getTime() - CLOCK_SKEW_MS > now) {
    throw new Error("SAML assertion is not yet valid (Conditions NotBefore is in the future).");
  }
  if (notOnOrAfter && new Date(notOnOrAfter).getTime() + CLOCK_SKEW_MS < now) {
    throw new Error("SAML assertion has expired (Conditions NotOnOrAfter has passed).");
  }
}

function checkAssertionIssuer(
  assertionEl: Element,
  doc: Document,
  expectedIdpEntityId: string | null | undefined,
): void {
  if (!expectedIdpEntityId) return; // Not configured for this org — nothing to enforce.

  const issuer =
    textOf(selectElements("./saml:Issuer", assertionEl)[0]) ??
    textOf(selectElements("/samlp:Response/saml:Issuer", doc)[0]);

  if (issuer !== expectedIdpEntityId) {
    throw new Error(
      `SAML assertion Issuer ("${issuer ?? "none"}") does not match the configured Identity Provider ("${expectedIdpEntityId}").`,
    );
  }
}

const EMAIL_ATTRIBUTE_NAMES = new Set([
  "email",
  "mail",
  "emailaddress",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
  "urn:oid:0.9.2342.19200300.100.1.3", // LDAP mail attribute OID
]);
const NAME_ATTRIBUTE_NAMES = new Set([
  "name",
  "displayname",
  "cn",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
]);

// Extracts NameID/email/name from the specific Assertion element that
// verifySignedAssertion() proved was the one actually signed — never from
// an independent re-query of the document, which is what would let a
// signature-wrapping attack smuggle a different (forged) assertion's data
// past a check that validated the wrong node.
function extractClaimsFromAssertion(assertionEl: Element): { sub?: string; email?: string; name?: string } {
  const nameId = textOf(selectElements("./saml:Subject/saml:NameID", assertionEl)[0]);

  const attributes: Record<string, string[]> = {};
  for (const attrNode of selectElements(".//saml:AttributeStatement/saml:Attribute", assertionEl)) {
    const attrName = attrNode.getAttribute("Name") || attrNode.getAttribute("FriendlyName");
    if (!attrName) continue;
    const values = selectElements("./saml:AttributeValue", attrNode)
      .map((v) => textOf(v))
      .filter((v): v is string => !!v);
    if (values.length > 0) attributes[attrName.toLowerCase()] = values;
  }

  let email: string | undefined;
  for (const [attrName, values] of Object.entries(attributes)) {
    if (EMAIL_ATTRIBUTE_NAMES.has(attrName)) {
      email = values[0];
      break;
    }
  }
  if (!email && nameId?.includes("@")) email = nameId;

  let name: string | undefined;
  for (const [attrName, values] of Object.entries(attributes)) {
    if (NAME_ATTRIBUTE_NAMES.has(attrName)) {
      name = values[0];
      break;
    }
  }

  return { sub: nameId || email, email: email || nameId, name };
}

export async function extractSamlUserInfo(
  samlResponse: string,
  certificate: string,
  expectedIdpEntityId?: string | null,
): Promise<{
  sub: string;
  email: string;
  name?: string;
}> {
  if (!certificate) {
    throw new Error("No SAML signing certificate configured for this organization.");
  }

  const xml = Buffer.from(samlResponse, "base64").toString("utf8");
  const doc = new DOMParser().parseFromString(xml, "text/xml") as unknown as Document;
  if (!doc?.documentElement) {
    throw new Error("SAML response is not valid XML.");
  }

  const assertionEl = verifySignedAssertion(doc, xml, certificate);
  checkAssertionConditions(assertionEl);
  checkAssertionIssuer(assertionEl, doc, expectedIdpEntityId);

  const claims = extractClaimsFromAssertion(assertionEl);
  if (!claims.sub && !claims.email) {
    throw new Error("Could not extract user information (NameID/email) from the verified SAML Assertion.");
  }

  return {
    sub: claims.sub || "",
    email: claims.email || "",
    name: claims.name,
  };
}
