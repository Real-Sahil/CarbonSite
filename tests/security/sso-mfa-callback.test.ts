// @vitest-environment node
/**
 * SSO sign-in must not link an existing account by its IdP-asserted email
 * unless that account already belongs to the org, and must refuse an
 * explicitly unverified email. First-time accounts keep working.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  ssoConfiguration: { findFirst: vi.fn() },
  user: { findUnique: vi.fn(), create: vi.fn() },
  account: { findFirst: vi.fn(), create: vi.fn() },
  organizationMembership: { findFirst: vi.fn(), create: vi.fn() },
  session: { create: vi.fn() },
}));

const sso = vi.hoisted(() => ({
  getSsoConfiguration: vi.fn(),
  exchangeOidcCodeForToken: vi.fn(),
  verifyOidcIdToken: vi.fn(),
  fetchOidcUserInfo: vi.fn(),
  validateSsoState: vi.fn(),
  recordSsoSession: vi.fn(),
  inferOidcEndpoint: vi.fn(),
  extractSamlUserInfo: vi.fn(),
  peekSamlIssuer: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/auth/index", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/auth/sso-handler", () => sso);

import { GET, POST } from "@/app/api/auth/sso/callback/route";

const ORG = "org-a";
const SAML_CONFIG = {
  organizationId: ORG,
  provider: "saml",
  enabled: true,
  idpEntityId: "https://idp.example.test",
  certificateX509: "CERT",
  autoCreateUsers: true,
  autoAssignRole: "viewer",
};
const OIDC_CONFIG = {
  ...SAML_CONFIG,
  provider: "generic_oidc",
  clientId: "client",
  clientSecret: "secret",
  metadataUrl: "https://idp.example.test/.well-known/openid-configuration",
};

function samlPost() {
  const form = new FormData();
  form.set("SAMLResponse", "PHNhbWxwOlJlc3BvbnNlLz4=");
  return new NextRequest("http://localhost/api/auth/sso/callback", { method: "POST", body: form });
}

function oidcGet() {
  return new NextRequest("http://localhost/api/auth/sso/callback?code=the-code&state=the-state", {
    headers: {
      cookie: `sso_state=the-state; sso_org_id=${ORG}; sso_provider=generic_oidc; sso_code_verifier=the-verifier`,
    },
  });
}

function setupSaml() {
  sso.peekSamlIssuer.mockReturnValue("https://idp.example.test");
  db.ssoConfiguration.findFirst.mockResolvedValue(SAML_CONFIG);
  sso.extractSamlUserInfo.mockResolvedValue({ sub: "sub-1", email: "ada@org-a.test", name: "Ada" });
}

function setupOidc(idTokenClaims: Record<string, unknown>) {
  sso.getSsoConfiguration.mockResolvedValue(OIDC_CONFIG);
  sso.validateSsoState.mockReturnValue(true);
  sso.inferOidcEndpoint.mockReturnValue("https://idp.example.test/endpoint");
  sso.exchangeOidcCodeForToken.mockResolvedValue({ idToken: "h.p.s", accessToken: "at", expiresIn: 3600 });
  sso.verifyOidcIdToken.mockResolvedValue({ sub: "sub-1", email: "ada@org-a.test", ...idTokenClaims });
  sso.fetchOidcUserInfo.mockResolvedValue({ sub: "sub-1", email: "ada@org-a.test", name: "Ada" });
}

beforeEach(() => {
  vi.clearAllMocks();
  db.user.findUnique.mockResolvedValue(null);
  db.user.create.mockResolvedValue({ id: "user-new", email: "ada@org-a.test" });
  db.account.findFirst.mockResolvedValue(null);
  db.account.create.mockResolvedValue({ id: "acc-new" });
  db.organizationMembership.findFirst.mockResolvedValue(null);
  db.organizationMembership.create.mockResolvedValue({ id: "m-new" });
  db.session.create.mockResolvedValue({ token: "session-token" });
  sso.recordSsoSession.mockResolvedValue(undefined);
  setupSaml();
});

describe("SAML sign-in and existing accounts", () => {
  it("refuses an existing account that is not a member of this org, and writes nothing", async () => {
    db.user.findUnique.mockResolvedValue({ id: "user-b", email: "ada@org-a.test" });

    const res = await POST(samlPost());

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "SSO_ACCOUNT_NOT_IN_ORG" });
    expect(db.organizationMembership.findFirst).toHaveBeenCalledWith({
      where: { userId: "user-b", organizationId: ORG, terminatedAt: null },
    });
    expect(db.user.create).not.toHaveBeenCalled();
    expect(db.account.create).not.toHaveBeenCalled();
    expect(db.organizationMembership.create).not.toHaveBeenCalled();
    expect(db.session.create).not.toHaveBeenCalled();
  });

  it("signs in an existing member of this org", async () => {
    db.user.findUnique.mockResolvedValue({ id: "user-a", email: "ada@org-a.test" });
    db.organizationMembership.findFirst.mockResolvedValue({ id: "m-a", role: "viewer" });
    db.account.findFirst.mockResolvedValue({ id: "acc-a" });

    const res = await POST(samlPost());

    expect([302, 307]).toContain(res.status);
    expect(res.cookies.get("better-auth.session_token")?.value).toBe("session-token");
    expect(db.user.create).not.toHaveBeenCalled();
    expect(db.organizationMembership.create).not.toHaveBeenCalled();
  });

  it("still creates a new account and its membership on first sign-in", async () => {
    const res = await POST(samlPost());

    expect([302, 307]).toContain(res.status);
    expect(db.user.create).toHaveBeenCalledTimes(1);
    expect(db.organizationMembership.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "user-new", organizationId: ORG, role: "viewer" }),
    });
  });
});

describe("OIDC email verification", () => {
  it.each([false, "false"])("refuses an ID token with email_verified %s before any write", async (claim) => {
    setupOidc({ email_verified: claim });

    const res = await GET(oidcGet());

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "SSO_EMAIL_NOT_VERIFIED" });
    expect(db.user.create).not.toHaveBeenCalled();
    expect(db.session.create).not.toHaveBeenCalled();
  });

  it("allows a first sign-in when the email_verified claim is absent", async () => {
    setupOidc({});

    const res = await GET(oidcGet());

    expect([302, 307]).toContain(res.status);
    expect(db.session.create).toHaveBeenCalledTimes(1);
  });

  it("passes the stored PKCE verifier to the token exchange unchanged", async () => {
    setupOidc({ email_verified: true });

    await GET(oidcGet());

    expect(sso.exchangeOidcCodeForToken.mock.calls[0][3]).toBe("the-verifier");
  });
});
