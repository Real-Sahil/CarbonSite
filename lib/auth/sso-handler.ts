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

interface JwkKey {
  kty: string;
  kid?: string;
  use?: string;
  alg?: string;
  n?: string;
  e?: string;
  x?: string;
  y?: string;
  crv?: string;
}

const jwksCache = new Map<string, { keys: JwkKey[]; fetchedAt: number }>();
const JWKS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function fetchJwks(jwksUri: string): Promise<JwkKey[]> {
  const cached = jwksCache.get(jwksUri);
  if (cached && Date.now() - cached.fetchedAt < JWKS_CACHE_TTL_MS) {
    return cached.keys;
  }
  const res = await fetch(jwksUri);
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  const { keys } = await res.json() as { keys: JwkKey[] };
  jwksCache.set(jwksUri, { keys, fetchedAt: Date.now() });
  return keys;
}

function base64urlDecode(s: string): Buffer {
  // Pad to a multiple of 4 and convert base64url → base64
  const padded = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
  return Buffer.from(padded, "base64");
}

async function verifyRs256(header: Record<string, string>, signingInput: string, signature: Buffer, key: JwkKey): Promise<boolean> {
  if (!key.n || !key.e) throw new Error("RSA key missing n or e");
  const jwk = {
    kty: "RSA",
    n: key.n,
    e: key.e,
    alg: header.alg ?? "RS256",
    use: "sig",
  };
  const cryptoKey = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  return crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, signature, Buffer.from(signingInput));
}

async function verifyEs256(header: Record<string, string>, signingInput: string, signature: Buffer, key: JwkKey): Promise<boolean> {
  if (!key.x || !key.y) throw new Error("EC key missing x or y");
  const jwk = {
    kty: "EC",
    crv: key.crv ?? "P-256",
    x: key.x,
    y: key.y,
    alg: header.alg ?? "ES256",
    use: "sig",
  };
  // ECDSA signature in JWT is r||s (raw), but WebCrypto expects IEEE P1363 (same for P-256)
  const cryptoKey = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: key.crv ?? "P-256" }, false, ["verify"]);
  return crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, cryptoKey, signature, Buffer.from(signingInput));
}

export async function verifyOidcIdToken(
  config: OidcConfig,
  idToken: string,
  clientId: string
): Promise<Record<string, unknown>> {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");

  const [rawHeader, rawPayload, rawSignature] = parts;
  const header = JSON.parse(base64urlDecode(rawHeader).toString()) as Record<string, string>;
  const payload = JSON.parse(base64urlDecode(rawPayload).toString()) as Record<string, unknown>;

  const alg = header.alg;
  if (!alg || !["RS256", "RS384", "RS512", "ES256", "ES384", "ES512"].includes(alg)) {
    throw new Error(`Unsupported or missing JWT algorithm: ${alg}`);
  }

  const jwksUri = config.jwksUri || (config.metadataUrl ? inferOidcEndpoint(config.metadataUrl, "jwks_uri") : "");
  if (!jwksUri) throw new Error("JWKS URI is not configured");

  const keys = await fetchJwks(jwksUri);
  const candidateKeys = header.kid
    ? keys.filter((k) => k.kid === header.kid)
    : keys.filter((k) => !k.use || k.use === "sig");

  if (candidateKeys.length === 0) throw new Error("No matching JWKS key found for JWT");

  const signingInput = `${rawHeader}.${rawPayload}`;
  const signature = base64urlDecode(rawSignature);

  let verified = false;
  for (const key of candidateKeys) {
    try {
      if (alg.startsWith("RS")) {
        verified = await verifyRs256(header, signingInput, signature, key);
      } else if (alg.startsWith("ES")) {
        verified = await verifyEs256(header, signingInput, signature, key);
      }
      if (verified) break;
    } catch {
      // try next key
    }
  }
  if (!verified) throw new Error("JWT signature verification failed");

  // Standard claims validation
  const aud = payload.aud;
  const audiences = Array.isArray(aud) ? aud : [aud];
  if (!audiences.includes(clientId)) throw new Error("Invalid audience in ID token");

  if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("ID token expired");
  }

  if (typeof payload.nbf === "number" && payload.nbf > Math.floor(Date.now() / 1000) + 60) {
    throw new Error("ID token not yet valid");
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

export function buildSamlAuthenticationRequest(config: SamlConfig): { id: string; encodedRequest: string } {
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

  return { id, encodedRequest: Buffer.from(xml).toString("base64") };
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

function checkInResponseTo(doc: Document, expectedRequestId: string | null | undefined): void {
  if (!expectedRequestId) return; // IdP-initiated (or SP-initiated tracking unavailable) — nothing to check.

  const responseEl = selectElements("/samlp:Response", doc)[0];
  const inResponseTo = responseEl?.getAttribute("InResponseTo");

  if (inResponseTo && inResponseTo !== expectedRequestId) {
    throw new Error(
      "SAML response InResponseTo does not match the request this browser session sent — possible replay of a different login attempt.",
    );
  }
}

// Unverified peek at the response's Issuer, used only to route an
// IdP-initiated login (no prior request from us, so no org-identifying
// cookie exists yet) to the right organization's SsoConfiguration before
// full verification runs. Never used for any trust decision itself — the
// resolved org's own stored certificate is what extractSamlUserInfo()
// actually verifies the signature against afterward.
export function peekSamlIssuer(samlResponse: string): string | null {
  try {
    const xml = Buffer.from(samlResponse, "base64").toString("utf8");
    const doc = new DOMParser().parseFromString(xml, "text/xml") as unknown as Document;
    if (!doc?.documentElement) return null;
    return (
      textOf(selectElements("/samlp:Response/saml:Issuer", doc)[0]) ??
      textOf(selectElements("//saml:Assertion/saml:Issuer", doc)[0]) ??
      null
    );
  } catch {
    return null;
  }
}

export async function extractSamlUserInfo(
  samlResponse: string,
  certificate: string,
  expectedIdpEntityId?: string | null,
  expectedRequestId?: string | null,
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
  checkInResponseTo(doc, expectedRequestId);

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
