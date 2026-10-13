import { afterEach, describe, expect, it, vi } from "vitest";
import { verifiedSessionToken } from "@/lib/auth/session-cookie";

// Signed with better-call's signCookieValue (the library Better Auth uses) under SECRET.
const SECRET = "test-secret-0123456789abcdef";
const TOKEN = "tokenABC123xyz987";
const SIGNATURE = "srvKoRx+x4WKM4AseP6fMnv4GLuz0PZX3rJoCDPipAU=";
const SIGNED = `${TOKEN}.${SIGNATURE}`;

describe("verifiedSessionToken", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the token for a cookie signed with BETTER_AUTH_SECRET", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", SECRET);
    expect(verifiedSessionToken(SIGNED)).toBe(TOKEN);
  });

  it("refuses a bare token, which a DB read would give away", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", SECRET);
    expect(verifiedSessionToken(TOKEN)).toBeNull();
  });

  it("refuses the token under a forged signature", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", SECRET);
    expect(verifiedSessionToken(`${TOKEN}.${"A".repeat(43)}=`)).toBeNull();
  });

  it("refuses another token under the original signature", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", SECRET);
    expect(verifiedSessionToken(`otherToken987.${SIGNATURE}`)).toBeNull();
  });

  it("refuses a cookie signed with another secret", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "another-secret-0123456789");
    expect(verifiedSessionToken(SIGNED)).toBeNull();
  });

  it("refuses everything when the secret is not configured", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "");
    expect(verifiedSessionToken(SIGNED)).toBeNull();
  });
});
