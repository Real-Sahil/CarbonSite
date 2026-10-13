import { afterEach, describe, expect, it, vi } from "vitest";

const requireOrgMember = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({
  requireOrgMember,
  ROLE_GROUPS: { admins: ["admin"] },
}));

import { oauthCallbackOrgId, readOAuthState, signOAuthState } from "@/lib/integrations/oauth-state";

const ORG = "org_abc";
const ADMIN = "user_admin";
const MINUTE = 60 * 1000;

describe("OAuth state (connect flows)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    requireOrgMember.mockReset();
  });

  it("round-trips the org and user it was issued to", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-oauth-state");
    expect(readOAuthState(signOAuthState(ORG, ADMIN))).toEqual({ orgId: ORG, userId: ADMIN });
  });

  it("rejects the unsigned state the callbacks used to trust", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-oauth-state");
    const unsigned = Buffer.from(JSON.stringify({ orgId: "org_victim" })).toString("base64url");
    expect(readOAuthState(unsigned)).toBeNull();
  });

  it("rejects a tampered org, a missing state and malformed input", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-oauth-state");
    const [body, signature] = signOAuthState(ORG, ADMIN).split(".");
    const victim = Buffer.from(JSON.stringify({ o: "org_victim", u: ADMIN, t: Date.now() })).toString("base64url");
    expect(readOAuthState(`${victim}.${signature}`)).toBeNull();
    expect(readOAuthState(null)).toBeNull();
    expect(readOAuthState("")).toBeNull();
    expect(readOAuthState(`${body}.${signature}.extra`)).toBeNull();
  });

  it("rejects a state signed with another secret", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-oauth-state");
    const state = signOAuthState(ORG, ADMIN);
    vi.stubEnv("BETTER_AUTH_SECRET", "rotated-secret");
    expect(readOAuthState(state)).toBeNull();
  });

  it("expires after 15 minutes and refuses states dated well in the future", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-oauth-state");
    const state = signOAuthState(ORG, ADMIN);
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + 14 * MINUTE);
    expect(readOAuthState(state)).not.toBeNull();
    vi.spyOn(Date, "now").mockReturnValue(now + 16 * MINUTE);
    expect(readOAuthState(state)).toBeNull();
    vi.spyOn(Date, "now").mockReturnValue(now - 6 * MINUTE);
    expect(readOAuthState(state)).toBeNull();
  });

  describe("oauthCallbackOrgId", () => {
    it("accepts the admin who started the flow", async () => {
      vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-oauth-state");
      requireOrgMember.mockResolvedValue({ session: { user: { id: ADMIN } } });
      await expect(oauthCallbackOrgId(signOAuthState(ORG, ADMIN))).resolves.toBe(ORG);
      expect(requireOrgMember).toHaveBeenCalledWith(ORG, "admin");
    });

    it("refuses a state issued to another user", async () => {
      vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-oauth-state");
      requireOrgMember.mockResolvedValue({ session: { user: { id: "user_other" } } });
      await expect(oauthCallbackOrgId(signOAuthState(ORG, ADMIN))).resolves.toBeNull();
    });

    it("refuses when there is no admin session for the org", async () => {
      vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-oauth-state");
      requireOrgMember.mockRejectedValue(new Error("UNAUTHENTICATED"));
      await expect(oauthCallbackOrgId(signOAuthState(ORG, ADMIN))).resolves.toBeNull();
    });

    it("never looks up membership for a forged state", async () => {
      vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-oauth-state");
      await expect(oauthCallbackOrgId("forged.state")).resolves.toBeNull();
      expect(requireOrgMember).not.toHaveBeenCalled();
    });
  });
});
