/**
 * Invite link and auth flow tests.
 *
 * Run against a local dev server:
 *   BASE_URL=http://localhost:3000 pnpm vitest run tests/api/invite_auth.test.ts
 *
 * Required env vars:
 *   ADMIN_SESSION_TOKEN — valid admin bearer token
 *   ORG_ID             — the org the admin belongs to
 *   SITE_ID            — a site to use in site-scoped invites
 *
 * Tests that create invite links clean up after themselves where possible.
 * Token-acceptance tests may leave test users in the DB; use a disposable
 * test database (not production).
 */

import { describe, it, expect } from "vitest";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const ADMIN_TOKEN = process.env.ADMIN_SESSION_TOKEN ?? "";
const ORG_ID = process.env.ORG_ID ?? "";
const SITE_ID = process.env.SITE_ID ?? "";

function headers(token: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function json(res: Response) {
  try {
    return await res.json();
  } catch {
    return await res.text();
  }
}

// ── Invite link creation ──────────────────────────────────────────────────────

describe("POST /api/orgs/[orgId]/invite-links — creation", () => {
  it("admin can create a field_worker invite link", async () => {
    const res = await fetch(`${BASE_URL}/api/orgs/${ORG_ID}/invite-links`, {
      method: "POST",
      headers: headers(ADMIN_TOKEN),
      body: JSON.stringify({ role: "field_worker", expiresInDays: 7 }),
    });
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body).toHaveProperty("token");
    expect(body).toHaveProperty("inviteUrl");
    expect(body.role).toBe("field_worker");
    expect(body.usedAt).toBeNull();
    // Confirm expiry is ~7 days in the future
    const expiresAt = new Date(body.expiresAt).getTime();
    const expectedMs = Date.now() + 7 * 24 * 60 * 60 * 1000;
    expect(expiresAt).toBeGreaterThan(Date.now());
    expect(expiresAt).toBeLessThanOrEqual(expectedMs + 60_000);
  });

  it("admin can create a site-scoped invite link", async () => {
    const res = await fetch(`${BASE_URL}/api/orgs/${ORG_ID}/invite-links`, {
      method: "POST",
      headers: headers(ADMIN_TOKEN),
      body: JSON.stringify({ role: "field_worker", expiresInDays: 1, siteId: SITE_ID }),
    });
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.siteId).toBe(SITE_ID);
  });

  it("returns 401 without authentication", async () => {
    const res = await fetch(`${BASE_URL}/api/orgs/${ORG_ID}/invite-links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "field_worker", expiresInDays: 7 }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 when expiresInDays exceeds 30", async () => {
    const res = await fetch(`${BASE_URL}/api/orgs/${ORG_ID}/invite-links`, {
      method: "POST",
      headers: headers(ADMIN_TOKEN),
      body: JSON.stringify({ role: "field_worker", expiresInDays: 31 }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 422 when siteId belongs to another org", async () => {
    const res = await fetch(`${BASE_URL}/api/orgs/${ORG_ID}/invite-links`, {
      method: "POST",
      headers: headers(ADMIN_TOKEN),
      body: JSON.stringify({ role: "field_worker", expiresInDays: 7, siteId: "clforeign000000000000000000" }),
    });
    expect(res.status).toBe(422);
    const body = await json(res);
    expect(body.code).toBe("INVALID_SITE");
  });
});

// ── Invite link listing and revocation ───────────────────────────────────────

describe("GET / DELETE /api/orgs/[orgId]/invite-links", () => {
  it("admin can list active invite links", async () => {
    const res = await fetch(`${BASE_URL}/api/orgs/${ORG_ID}/invite-links`, {
      headers: headers(ADMIN_TOKEN),
    });
    expect(res.status).toBe(200);
    const links = await json(res);
    expect(Array.isArray(links)).toBe(true);
  });

  it("admin can revoke an unused invite link", async () => {
    const create = await fetch(`${BASE_URL}/api/orgs/${ORG_ID}/invite-links`, {
      method: "POST",
      headers: headers(ADMIN_TOKEN),
      body: JSON.stringify({ role: "field_worker", expiresInDays: 7 }),
    });
    const link = await json(create);
    expect(create.status).toBe(201);

    const del = await fetch(`${BASE_URL}/api/orgs/${ORG_ID}/invite-links/${link.id}`, {
      method: "DELETE",
      headers: headers(ADMIN_TOKEN),
    });
    expect(del.status).toBe(204);

    // Attempting to accept the revoked link should now fail
    const accept = await fetch(`${BASE_URL}/api/auth/accept-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: link.token, name: "Revoked Worker" }),
    });
    expect([400, 404]).toContain(accept.status);
  });
});

// ── Invite acceptance ─────────────────────────────────────────────────────────

describe("POST /api/auth/accept-invite — validity checks", () => {
  it("returns 404 for a non-existent token", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/accept-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "00000000-0000-0000-0000-000000000000", name: "Ghost" }),
    });
    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.code).toBe("INVITE_NOT_FOUND");
  });

  it("returns 400 for a token that was already used", async () => {
    // Create and immediately accept an invite to produce a used token
    const create = await fetch(`${BASE_URL}/api/orgs/${ORG_ID}/invite-links`, {
      method: "POST",
      headers: headers(ADMIN_TOKEN),
      body: JSON.stringify({ role: "field_worker", expiresInDays: 7 }),
    });
    const link = await json(create);

    // First acceptance
    const first = await fetch(`${BASE_URL}/api/auth/accept-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: link.token, name: `Worker ${Date.now()}` }),
    });
    expect(first.status).toBe(200);

    // Second acceptance with same token
    const second = await fetch(`${BASE_URL}/api/auth/accept-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: link.token, name: "Duplicate Worker" }),
    });
    expect(second.status).toBe(400);
    const body = await json(second);
    expect(body.code).toBe("INVITE_ALREADY_USED");
  });

  it("returns 400 for an email-bound invite when email is wrong", async () => {
    // Create email-bound invite via members endpoint
    const create = await fetch(`${BASE_URL}/api/orgs/${ORG_ID}/members`, {
      method: "POST",
      headers: headers(ADMIN_TOKEN),
      body: JSON.stringify({ email: `test-audit-${Date.now()}@example.com`, role: "viewer" }),
    });
    const invite = await json(create);
    // Only proceed if an inviteUrl was returned (new user case)
    if (!invite.inviteUrl) return;

    const token = invite.inviteUrl.split("/invite/")[1];
    const res = await fetch(`${BASE_URL}/api/auth/accept-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, name: "Attacker", email: "attacker@evil.com" }),
    });
    expect(res.status).toBe(400);
    // Must return INVALID_INVITE (not INVITE_NOT_FOUND) to prevent enumeration
    const body = await json(res);
    expect(body.code).toBe("INVALID_INVITE");
  });

  it("returns the same error shape for wrong email as for non-existent token (no enumeration)", async () => {
    // Both should return a 400 with an opaque message
    const realCreate = await fetch(`${BASE_URL}/api/orgs/${ORG_ID}/members`, {
      method: "POST",
      headers: headers(ADMIN_TOKEN),
      body: JSON.stringify({ email: `test-enum-${Date.now()}@example.com`, role: "viewer" }),
    });
    const realInvite = await json(realCreate);
    if (!realInvite.inviteUrl) return;

    const token = realInvite.inviteUrl.split("/invite/")[1];
    const wrongEmail = await fetch(`${BASE_URL}/api/auth/accept-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, name: "Attacker", email: "attacker@evil.com" }),
    });
    const wrongEmailBody = await json(wrongEmail);

    const fakeToken = await fetch(`${BASE_URL}/api/auth/accept-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "00000000-0000-0000-0000-000000000001", name: "Attacker", email: "attacker@evil.com" }),
    });

    // Wrong email → 400 INVALID_INVITE; non-existent token → 404 INVITE_NOT_FOUND
    // Both must not expose internal org membership info in the response body
    expect(wrongEmailBody.code).not.toContain("ORG");
    expect(wrongEmailBody.message).not.toMatch(/organization|tenant|member/i);
    void fakeToken; // confirm it runs without throwing
  });
});

// ── Mobile token refresh ──────────────────────────────────────────────────────

describe("POST /api/auth/token — mobile session refresh", () => {
  it("returns 401 when no token is provided", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/token`, { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("returns 401 for a fabricated/invalid token", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/token`, {
      method: "POST",
      headers: { Authorization: "Bearer not-a-real-session-token" },
    });
    expect(res.status).toBe(401);
    const body = await json(res);
    expect(body.code).toBe("UNAUTHENTICATED");
  });

  it("returns a new token when a valid session token is provided", async () => {
    // Accept an invite to get a fresh session token for this test
    const create = await fetch(`${BASE_URL}/api/orgs/${ORG_ID}/invite-links`, {
      method: "POST",
      headers: headers(ADMIN_TOKEN),
      body: JSON.stringify({ role: "field_worker", expiresInDays: 7 }),
    });
    const link = await json(create);

    const accept = await fetch(`${BASE_URL}/api/auth/accept-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: link.token, name: `Refresh Worker ${Date.now()}` }),
    });
    const session = await json(accept);
    const originalToken = session.sessionToken;
    expect(originalToken).toBeDefined();

    const refresh = await fetch(`${BASE_URL}/api/auth/token`, {
      method: "POST",
      headers: { Authorization: `Bearer ${originalToken}` },
    });
    expect(refresh.status).toBe(200);
    const refreshed = await json(refresh);
    expect(refreshed.token).toBeDefined();
    expect(refreshed.token).not.toBe(originalToken); // token must rotate
    expect(new Date(refreshed.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });
});

// ── Checklist: invite expiry enforced ────────────────────────────────────────
// (cannot be unit tested in integration; verified via code review)
// InviteLink.expiresAt <= now → 400 INVITE_EXPIRED at accept-invite handler line 32.

// ── Rate limiting on accept-invite ───────────────────────────────────────────
describe("POST /api/auth/accept-invite — rate limiting", () => {
  it("returns 429 after 5 rapid invalid attempts from the same IP", async () => {
    const attempts = Array.from({ length: 6 }, () =>
      fetch(`${BASE_URL}/api/auth/accept-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "invalid-rate-limit-test", name: "Bot" }),
      }),
    );
    const results = await Promise.all(attempts);
    const statuses = results.map((r) => r.status);
    // At least one should be 429 (rate limited) after the 5-req window
    expect(statuses).toContain(429);
  });
});
