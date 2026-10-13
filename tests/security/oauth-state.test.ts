import { createHmac } from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

const requireOrgMember = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({
  requireOrgMember,
  ROLE_GROUPS: { admins: ["admin"] },
}));

import { oauthCallbackOrgId, readOAuthState, signOAuthState } from "@/lib/integrations/oauth-state";

const ORG = "org_abc";
const ADMIN = "user_admin";
const SESSION = "session_admin";
const MINUTE = 60 * 1000;
const SECRET = "test-secret-oauth-state";

// What requireOrgMember resolves to for a signed-in admin on one session row.
const signedInAs = (userId: string, sessionId: string) => ({
  session: { user: { id: userId }, session: { id: sessionId } },
});

describe("OAuth state (connect flows)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    requireOrgMember.mockReset();
  });

  it("round-trips the org, admin and session it was issued to", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", SECRET);
    expect(readOAuthState(signOAuthState(ORG, ADMIN, SESSION))).toEqual({
      orgId: ORG,
      userId: ADMIN,
      sessionId: SESSION,
    });
  });

  it("rejects the unsigned state the callbacks used to trust", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", SECRET);
    const unsigned = Buffer.from(JSON.stringify({ orgId: "org_victim" })).toString("base64url");
    expect(readOAuthState(unsigned)).toBeNull();
  });

  it("rejects a correctly signed state from before sessions were bound", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", SECRET);
    const body = Buffer.from(JSON.stringify({ o: ORG, u: ADMIN, t: Date.now() })).toString("base64url");
    const signature = createHmac("sha256", SECRET).update(`oauth-state:${body}`).digest("base64url");
    expect(readOAuthState(`${body}.${signature}`)).toBeNull();
  });

  it("rejects a tampered org, a missing state and malformed input", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", SECRET);
    const [body, signature] = signOAuthState(ORG, ADMIN, SESSION).split(".");
    const victim = Buffer.from(
      JSON.stringify({ o: "org_victim", u: ADMIN, s: SESSION, t: Date.now() }),
    ).toString("base64url");
    expect(readOAuthState(`${victim}.${signature}`)).toBeNull();
    expect(readOAuthState(null)).toBeNull();
    expect(readOAuthState("")).toBeNull();
    expect(readOAuthState(`${body}.${signature}.extra`)).toBeNull();
  });

  it("rejects a state signed with another secret", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", SECRET);
    const state = signOAuthState(ORG, ADMIN, SESSION);
    vi.stubEnv("BETTER_AUTH_SECRET", "rotated-secret");
    expect(readOAuthState(state)).toBeNull();
  });

  it("expires after 15 minutes and refuses states dated well in the future", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", SECRET);
    const state = signOAuthState(ORG, ADMIN, SESSION);
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + 14 * MINUTE);
    expect(readOAuthState(state)).not.toBeNull();
    vi.spyOn(Date, "now").mockReturnValue(now + 16 * MINUTE);
    expect(readOAuthState(state)).toBeNull();
    vi.spyOn(Date, "now").mockReturnValue(now - 6 * MINUTE);
    expect(readOAuthState(state)).toBeNull();
  });

  describe("oauthCallbackOrgId", () => {
    it("accepts the admin in the session that started the flow", async () => {
      vi.stubEnv("BETTER_AUTH_SECRET", SECRET);
      requireOrgMember.mockResolvedValue(signedInAs(ADMIN, SESSION));
      await expect(oauthCallbackOrgId(signOAuthState(ORG, ADMIN, SESSION))).resolves.toBe(ORG);
      expect(requireOrgMember).toHaveBeenCalledWith(ORG, "admin");
    });

    it("refuses a state issued to another user", async () => {
      vi.stubEnv("BETTER_AUTH_SECRET", SECRET);
      requireOrgMember.mockResolvedValue(signedInAs("user_other", SESSION));
      await expect(oauthCallbackOrgId(signOAuthState(ORG, ADMIN, SESSION))).resolves.toBeNull();
    });

    it("refuses a flow started in another session, even for the same admin", async () => {
      vi.stubEnv("BETTER_AUTH_SECRET", SECRET);
      requireOrgMember.mockResolvedValue(signedInAs(ADMIN, "session_other"));
      await expect(oauthCallbackOrgId(signOAuthState(ORG, ADMIN, SESSION))).resolves.toBeNull();
    });

    it("refuses when there is no admin session for the org", async () => {
      vi.stubEnv("BETTER_AUTH_SECRET", SECRET);
      requireOrgMember.mockRejectedValue(new Error("UNAUTHENTICATED"));
      await expect(oauthCallbackOrgId(signOAuthState(ORG, ADMIN, SESSION))).resolves.toBeNull();
    });

    it("never looks up membership for a forged state", async () => {
      vi.stubEnv("BETTER_AUTH_SECRET", SECRET);
      await expect(oauthCallbackOrgId("forged.state")).resolves.toBeNull();
      expect(requireOrgMember).not.toHaveBeenCalled();
    });
  });
});
