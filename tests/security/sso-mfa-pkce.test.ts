// @vitest-environment node
/**
 * PKCE (RFC 7636): the authorize step sends S256(verifier) as code_challenge,
 * and the verifier itself stays in the cookie for the callback's token exchange.
 */
import { createHash } from "crypto";
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { generateCodeChallenge, generateCodeVerifier } from "@/lib/auth/sso-handler";

const sso = vi.hoisted(() => ({ getSsoConfiguration: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/auth/sso-handler", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/sso-handler")>()),
  getSsoConfiguration: sso.getSsoConfiguration,
}));

import { GET } from "@/app/api/auth/sso/authorize/route";

const RFC_VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const RFC_CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

// Computed without the code under test, so a wrong helper cannot pass by agreeing with itself.
function referenceChallenge(verifier: string): string {
  return createHash("sha256")
    .update(verifier)
    .digest("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

describe("PKCE helpers", () => {
  it("matches the RFC 7636 appendix B vector", () => {
    expect(generateCodeChallenge(RFC_VERIFIER)).toBe(RFC_CHALLENGE);
  });

  it("generates unpadded verifiers and challenges", () => {
    for (let i = 0; i < 20; i++) {
      const verifier = generateCodeVerifier();
      expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(generateCodeChallenge(verifier)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
  });
});

describe("OIDC authorize step", () => {
  it("sends S256 of the stored verifier and keeps the raw verifier in its cookie", async () => {
    sso.getSsoConfiguration.mockResolvedValue({
      enabled: true,
      provider: "generic_oidc",
      clientId: "client",
      clientSecret: "secret",
      metadataUrl: "https://idp.example.test/.well-known/openid-configuration",
    });

    const res = await GET(
      new NextRequest("http://localhost/api/auth/sso/authorize?orgId=org-a&provider=generic_oidc"),
    );

    expect(res.status).toBe(200);
    const verifier = res.cookies.get("sso_code_verifier")?.value ?? "";
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const url = new URL((await res.json()).url);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe(referenceChallenge(verifier));
    expect(url.searchParams.get("code_challenge")).not.toBe(verifier);
  });
});
