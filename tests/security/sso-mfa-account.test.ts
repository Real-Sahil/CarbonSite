// @vitest-environment node
/**
 * Account security through the real session helpers: an MFA secret can only be
 * replaced with the current authenticator, an expired or revoked mobile session
 * is refused, an admin password reset ends the supplier's sessions, and the
 * onboarding status is not open to field workers.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import speakeasy from "speakeasy";

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn() },
  session: { findUnique: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  account: { findFirst: vi.fn(), update: vi.fn() },
  organizationMembership: { findUnique: vi.fn(), count: vi.fn() },
  organization: { findUnique: vi.fn() },
  reportingPeriod: { count: vi.fn() },
  activityRecord: { count: vi.fn() },
  calculationRun: { count: vi.fn() },
  onboardingProgress: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));
const authGetSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn(async () => undefined) }));
vi.mock("@/lib/auth/index", () => ({ auth: { api: { getSession: authGetSession } } }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/security/rate-limit-async", () => ({ rateLimitRequest: vi.fn(async () => null) }));
vi.mock("@/lib/auth/temporary-password", () => ({
  accountBelongsOnlyToOrg: vi.fn(async () => true),
  generateTemporaryPassword: vi.fn(() => "Temp-Pass-1234"),
  hashTemporaryPassword: vi.fn(async () => "hashed-password"),
}));

import { POST as verifyMfa } from "@/app/api/account/mfa/verify/route";
import { POST as refreshToken } from "@/app/api/auth/token/route";
import { POST as resetPassword } from "@/app/api/orgs/[orgId]/supplier-accounts/[userId]/reset-password/route";
import { GET as getOnboarding } from "@/app/api/orgs/[orgId]/onboarding/route";

const DAY = 86_400_000;
const CURRENT_SECRET = "JBSWY3DPEHPK3PXP";
const NEW_SECRET = "GEZDGNBVGY3TQOJQ";
const OTHER_SECRET = "KRSXG5CTMVRXEZLU";

function code(secret: string): string {
  return speakeasy.totp({ secret, encoding: "base32" });
}

function signInAs(userId: string) {
  authGetSession.mockResolvedValue({
    session: {
      id: `sess-${userId}`,
      token: "browser-token",
      userId,
      expiresAt: new Date(Date.now() + DAY),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    user: {
      id: userId,
      email: `${userId}@org-a.test`,
      emailVerified: true,
      name: "Test User",
      themePreference: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

function members(roles: Record<string, string>) {
  db.organizationMembership.findUnique.mockImplementation(
    async ({ where }: { where: { organizationId_userId: { organizationId: string; userId: string } } }) => {
      const { organizationId, userId } = where.organizationId_userId;
      const role = roles[userId];
      return role ? { organizationId, userId, role, terminatedAt: null } : null;
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Runs the callback against the same mocks, as the real transaction would.
  db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db));
  // loadSession reads the row's revokedAt on every signed-in request.
  db.session.findUnique.mockResolvedValue({ revokedAt: null });
  db.user.findUnique.mockResolvedValue({ email: "supplier@org-a.test" });
  db.account.findFirst.mockResolvedValue({ id: "acc-1" });
});

describe("MFA secret replacement", () => {
  function mfaCall(body: Record<string, string>) {
    signInAs("user-1");
    return verifyMfa(
      new NextRequest("http://localhost/api/account/mfa/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  }

  it("refuses to replace an active secret without the current code, and writes nothing", async () => {
    db.user.findUnique.mockResolvedValue({ twoFactorEnabled: true, twoFactorSecret: CURRENT_SECRET });

    const res = await mfaCall({ secret: NEW_SECRET, code: code(NEW_SECRET) });

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "INVALID_CODE" });
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("refuses a current code generated from some other secret", async () => {
    db.user.findUnique.mockResolvedValue({ twoFactorEnabled: true, twoFactorSecret: CURRENT_SECRET });

    const res = await mfaCall({ secret: NEW_SECRET, code: code(NEW_SECRET), currentCode: code(OTHER_SECRET) });

    expect(res.status).toBe(400);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("refuses a replacement when MFA is on but no secret is stored", async () => {
    db.user.findUnique.mockResolvedValue({ twoFactorEnabled: true, twoFactorSecret: null });

    const res = await mfaCall({ secret: NEW_SECRET, code: code(NEW_SECRET), currentCode: code(CURRENT_SECRET) });

    expect(res.status).toBe(400);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("replaces the secret when the current authenticator's code is given", async () => {
    db.user.findUnique.mockResolvedValue({ twoFactorEnabled: true, twoFactorSecret: CURRENT_SECRET });

    const res = await mfaCall({ secret: NEW_SECRET, code: code(NEW_SECRET), currentCode: code(CURRENT_SECRET) });

    expect(res.status).toBe(201);
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: expect.objectContaining({ twoFactorSecret: NEW_SECRET, twoFactorEnabled: true }),
    });
  });

  it("enrols MFA without a current code when none is active", async () => {
    db.user.findUnique.mockResolvedValue({ twoFactorEnabled: false, twoFactorSecret: null });

    const res = await mfaCall({ secret: NEW_SECRET, code: code(NEW_SECRET) });

    expect(res.status).toBe(201);
    expect(db.user.update).toHaveBeenCalledTimes(1);
  });
});

describe("mobile session refresh", () => {
  const tokenRequest = () =>
    new NextRequest("http://localhost/api/auth/token", {
      method: "POST",
      headers: { authorization: "Bearer old-token" },
    });

  it("refuses a session that expired a day ago, and does not rotate it", async () => {
    db.session.findUnique.mockResolvedValue({
      id: "sess-1",
      createdAt: new Date(Date.now() - 2 * DAY),
      expiresAt: new Date(Date.now() - DAY),
      revokedAt: null,
      userId: "user-1",
    });

    const res = await refreshToken(tokenRequest());

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: "SESSION_EXPIRED" });
    expect(db.session.updateMany).not.toHaveBeenCalled();
  });

  it("refuses a revoked session that has not yet expired", async () => {
    db.session.findUnique.mockResolvedValue({
      id: "sess-1",
      createdAt: new Date(Date.now() - DAY),
      expiresAt: new Date(Date.now() + DAY),
      revokedAt: new Date(),
      userId: "user-1",
    });

    const res = await refreshToken(tokenRequest());

    expect(res.status).toBe(401);
    expect(db.session.updateMany).not.toHaveBeenCalled();
  });

  it("rotates the token of a live session, conditional on the old token", async () => {
    db.session.findUnique.mockResolvedValue({
      id: "sess-1",
      createdAt: new Date(Date.now() - DAY),
      expiresAt: new Date(Date.now() + DAY),
      revokedAt: null,
      userId: "user-1",
    });
    db.session.updateMany.mockResolvedValue({ count: 1 });

    const res = await refreshToken(tokenRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.token).not.toBe("old-token");
    expect(db.session.updateMany).toHaveBeenCalledWith({
      where: { id: "sess-1", token: "old-token", revokedAt: null },
      data: { token: body.token, expiresAt: expect.any(Date) },
    });
  });
});

describe("admin password reset for a supplier", () => {
  const context = { params: Promise.resolve({ orgId: "org-a", userId: "sup-1" }) };
  const resetRequest = () =>
    new NextRequest("http://localhost/api/orgs/org-a/supplier-accounts/sup-1/reset-password", {
      method: "POST",
    });

  it("changes the password and deletes the supplier's sessions in one transaction", async () => {
    signInAs("admin-1");
    members({ "admin-1": "admin", "sup-1": "supplier" });

    const res = await resetPassword(resetRequest(), context);

    expect(res.status).toBe(200);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "sup-1" } });
    expect(db.account.update).toHaveBeenCalledWith({
      where: { id: "acc-1" },
      data: { password: "hashed-password" },
    });
  });

  it("refuses a member who is not an admin, and changes nothing", async () => {
    signInAs("editor-1");
    members({ "editor-1": "editor", "sup-1": "supplier" });

    const res = await resetPassword(resetRequest(), context);

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "INSUFFICIENT_ROLE" });
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.session.deleteMany).not.toHaveBeenCalled();
  });
});

describe("onboarding status", () => {
  const context = { params: Promise.resolve({ orgId: "org-a" }) };
  const statusRequest = () => new NextRequest("http://localhost/api/orgs/org-a/onboarding");

  it("is not open to a field worker", async () => {
    signInAs("fw-1");
    members({ "fw-1": "field_worker" });

    const res = await getOnboarding(statusRequest(), context);

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "INSUFFICIENT_ROLE" });
    expect(db.organization.findUnique).not.toHaveBeenCalled();
  });

  it("is served to a viewer", async () => {
    signInAs("viewer-1");
    members({ "viewer-1": "viewer" });
    db.organization.findUnique.mockResolvedValue({ id: "org-a", name: "Org A", industry: null, hqCountry: null });
    db.organizationMembership.count.mockResolvedValue(1);
    db.reportingPeriod.count.mockResolvedValue(0);
    db.activityRecord.count.mockResolvedValue(0);
    db.calculationRun.count.mockResolvedValue(0);
    db.onboardingProgress.findUnique.mockResolvedValue(null);

    const res = await getOnboarding(statusRequest(), context);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ isComplete: false, steps: expect.any(Array) });
  });
});
