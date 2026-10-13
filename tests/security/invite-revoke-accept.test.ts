// @vitest-environment node
/**
 * Invite acceptance. An unbound link never enters an existing account, a supplier
 * joins an existing account only from its own session, a link is claimed before
 * anything is written, and the demo reviewer session lasts 30 days.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { hashPassword } from "better-auth/crypto";
import { writeAuditLog } from "@/lib/db/audit";
import { POST as acceptInvite } from "@/app/api/auth/accept-invite/route";
import { POST as acceptSupplierInvite } from "@/app/api/auth/accept-supplier-invite/route";
import { POST as registerSupplier } from "@/app/api/auth/supplier/register/route";

const db = vi.hoisted(() => {
  const model = () => ({
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
  });
  const prisma = {
    user: model(),
    account: model(),
    organization: model(),
    organizationMembership: model(),
    inviteLink: model(),
    supplierInvite: model(),
    session: model(),
    fieldWorkerSiteAssignment: model(),
    reportingPeriod: model(),
    contract: model(),
    project: model(),
    site: model(),
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation((fn: (tx: typeof prisma) => unknown) => fn(prisma));
  return prisma;
});

const session = vi.hoisted(() => ({ getSession: vi.fn() }));
const limiter = vi.hoisted(() => ({ rateLimitRequest: vi.fn().mockResolvedValue(null) }));

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/security/rate-limit-async", () => limiter);
vi.mock("@/lib/auth/session", () => ({
  getSession: session.getSession,
  AuthError: class AuthError extends Error {},
}));
vi.mock("better-auth/crypto", () => ({ hashPassword: vi.fn(async () => "hashed-password") }));

const DAY = 86_400_000;
const DEMO_TOKEN = "demo-reviewer-test-token-0000000000000";

function inviteLink(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv-1",
    organizationId: "org-a",
    role: "field_worker",
    email: null,
    siteId: null,
    reusable: false,
    usedAt: null,
    usedByUserId: null,
    expiresAt: new Date(Date.now() + DAY),
    organization: { id: "org-a", name: "Org A" },
    ...overrides,
  };
}

function supplierInvite() {
  return {
    id: "si-1",
    organizationId: "org-a",
    email: "sup@example.test",
    usedAt: null,
    expiresAt: new Date(Date.now() + DAY),
    organization: { id: "org-a", name: "Org A" },
  };
}

function post(path: string, body: unknown) {
  return new NextRequest(`http://localhost${path}`, { method: "POST", body: JSON.stringify(body) });
}

beforeEach(() => {
  session.getSession.mockResolvedValue(null);
});

describe("POST /api/auth/accept-invite", () => {
  it("refuses an unbound link for an account that already exists", async () => {
    db.inviteLink.findUnique.mockResolvedValue(inviteLink());
    db.user.findUnique.mockResolvedValue({ id: "u-existing", name: "Owner", email: "owner@example.test" });

    const res = await acceptInvite(
      post("/api/auth/accept-invite", { token: "tok-1", name: "Intruder", email: "owner@example.test" }),
    );

    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("ACCOUNT_EXISTS");
    expect(db.inviteLink.updateMany).not.toHaveBeenCalled();
    expect(db.organizationMembership.create).not.toHaveBeenCalled();
    expect(db.session.create).not.toHaveBeenCalled();
  });

  it("writes no membership or session when an email-bound link loses the claim", async () => {
    db.inviteLink.findUnique.mockResolvedValue(inviteLink({ email: "new@example.test" }));
    db.user.findUnique.mockResolvedValue(null);
    db.user.create.mockResolvedValue({ id: "u-new", email: "new@example.test", name: "New" });
    db.organizationMembership.findUnique.mockResolvedValue(null);
    db.inviteLink.updateMany.mockResolvedValue({ count: 0 });

    const res = await acceptInvite(
      post("/api/auth/accept-invite", { token: "tok-1", name: "New", email: "new@example.test" }),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVITE_ALREADY_USED");
    expect(db.organizationMembership.create).not.toHaveBeenCalled();
    expect(db.session.create).not.toHaveBeenCalled();
    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  it("claims an email-bound link before it writes the membership and session", async () => {
    db.inviteLink.findUnique.mockResolvedValue(inviteLink({ email: "new@example.test" }));
    db.user.findUnique.mockResolvedValue(null);
    db.user.create.mockResolvedValue({ id: "u-new", email: "new@example.test", name: "New" });
    db.organizationMembership.findUnique.mockResolvedValue(null);
    db.organizationMembership.create.mockResolvedValue({ id: "m-1", role: "field_worker" });
    db.inviteLink.updateMany.mockResolvedValue({ count: 1 });

    const res = await acceptInvite(
      post("/api/auth/accept-invite", { token: "tok-1", name: "New", email: "new@example.test" }),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).sessionToken).toEqual(expect.any(String));
    expect(db.inviteLink.updateMany).toHaveBeenCalledWith({
      where: { id: "inv-1", usedAt: null },
      data: { usedAt: expect.any(Date), usedByUserId: "u-new" },
    });
    expect(db.inviteLink.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      db.organizationMembership.create.mock.invocationCallOrder[0],
    );
    expect(db.session.create).toHaveBeenCalledTimes(1);
  });

  it("leaves a reusable link unclaimed", async () => {
    db.inviteLink.findUnique.mockResolvedValue(inviteLink({ email: "new@example.test", reusable: true }));
    db.user.findUnique.mockResolvedValue(null);
    db.user.create.mockResolvedValue({ id: "u-new", email: "new@example.test", name: "New" });
    db.organizationMembership.findUnique.mockResolvedValue(null);
    db.organizationMembership.create.mockResolvedValue({ id: "m-1", role: "field_worker" });

    const res = await acceptInvite(
      post("/api/auth/accept-invite", { token: "tok-1", name: "New", email: "new@example.test" }),
    );

    expect(res.status).toBe(200);
    expect(db.inviteLink.updateMany).not.toHaveBeenCalled();
  });

  it("gives the demo reviewer a session that lasts 30 days", async () => {
    vi.stubEnv("DEMO_REVIEWER_TOKEN", DEMO_TOKEN);
    try {
      db.organization.upsert.mockResolvedValue({ id: "demo-reviewer-org-00000000000000", name: "MetricOra Demo" });
      db.user.upsert.mockResolvedValue({
        id: "demo-reviewer-user-0000000000000",
        name: "Reviewer",
        email: "reviewer@metricora-demo.app",
      });
      db.account.findFirst.mockResolvedValue({ id: "acc-1" });

      const before = Date.now();
      const res = await acceptInvite(post("/api/auth/accept-invite", { token: DEMO_TOKEN, name: "Reviewer" }));
      const after = Date.now();

      expect(res.status).toBe(200);
      const { expiresAt } = db.session.create.mock.calls[0][0].data;
      const lifetime = expiresAt.getTime() - before;
      expect(lifetime).toBeGreaterThanOrEqual(30 * DAY);
      expect(lifetime).toBeLessThanOrEqual(30 * DAY + (after - before));
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("POST /api/auth/accept-supplier-invite", () => {
  it("refuses an existing account unless the same person is signed in", async () => {
    db.supplierInvite.findUnique.mockResolvedValue(supplierInvite());
    db.user.findUnique.mockResolvedValue({ id: "u-existing", name: "", email: "sup@example.test" });

    const res = await acceptSupplierInvite(
      post("/api/auth/accept-supplier-invite", { token: "sup-tok", name: "Supplier" }),
    );

    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("SIGN_IN_TO_ACCEPT");
    expect(db.supplierInvite.updateMany).not.toHaveBeenCalled();
    expect(db.organizationMembership.create).not.toHaveBeenCalled();
    expect(db.session.create).not.toHaveBeenCalled();
  });

  it("keeps the role of an existing member", async () => {
    db.supplierInvite.findUnique.mockResolvedValue(supplierInvite());
    db.user.findUnique.mockResolvedValue({ id: "u-existing", name: "Sam", email: "sup@example.test" });
    session.getSession.mockResolvedValue({ user: { id: "u-existing" } });
    db.organizationMembership.findUnique.mockResolvedValue({ id: "m-1", role: "admin" });

    const res = await acceptSupplierInvite(
      post("/api/auth/accept-supplier-invite", { token: "sup-tok", name: "Sam" }),
    );

    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("ALREADY_MEMBER");
    expect(db.organizationMembership.create).not.toHaveBeenCalled();
    expect(db.organizationMembership.upsert).not.toHaveBeenCalled();
    expect(db.supplierInvite.updateMany).not.toHaveBeenCalled();
  });

  it("joins a signed-in account as supplier without issuing a session", async () => {
    db.supplierInvite.findUnique.mockResolvedValue(supplierInvite());
    db.user.findUnique.mockResolvedValue({ id: "u-existing", name: "Sam", email: "sup@example.test" });
    session.getSession.mockResolvedValue({ user: { id: "u-existing" } });
    db.organizationMembership.findUnique.mockResolvedValue(null);
    db.supplierInvite.updateMany.mockResolvedValue({ count: 1 });
    db.organizationMembership.create.mockResolvedValue({ id: "m-2", role: "supplier" });

    const res = await acceptSupplierInvite(
      post("/api/auth/accept-supplier-invite", { token: "sup-tok", name: "Sam" }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).not.toHaveProperty("sessionToken");
    expect(body.role).toBe("supplier");
    expect(db.organizationMembership.create).toHaveBeenCalledWith({
      data: { organizationId: "org-a", userId: "u-existing", role: "supplier" },
    });
    expect(db.session.create).not.toHaveBeenCalled();
  });

  it("creates the account, its session and its membership once the claim holds", async () => {
    db.supplierInvite.findUnique.mockResolvedValue(supplierInvite());
    db.user.findUnique.mockResolvedValue(null);
    db.supplierInvite.updateMany.mockResolvedValue({ count: 1 });

    const res = await acceptSupplierInvite(
      post("/api/auth/accept-supplier-invite", { token: "sup-tok", name: "New Supplier" }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessionToken).toEqual(expect.any(String));
    expect(body.user.email).toBe("sup@example.test");
    expect(db.user.create).toHaveBeenCalledTimes(1);
    expect(db.session.create).toHaveBeenCalledTimes(1);
    expect(db.organizationMembership.create).toHaveBeenCalledTimes(1);
  });

  it("creates nothing when the claim is lost", async () => {
    db.supplierInvite.findUnique.mockResolvedValue(supplierInvite());
    db.user.findUnique.mockResolvedValue(null);
    db.supplierInvite.updateMany.mockResolvedValue({ count: 0 });

    const res = await acceptSupplierInvite(
      post("/api/auth/accept-supplier-invite", { token: "sup-tok", name: "New Supplier" }),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVITE_ALREADY_USED");
    expect(db.user.create).not.toHaveBeenCalled();
    expect(db.session.create).not.toHaveBeenCalled();
    expect(db.organizationMembership.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/supplier/register", () => {
  const registration = { email: "sup@example.test", password: "long-enough-password", inviteToken: "sup-tok" };

  it("refuses an existing account before it hashes or writes anything", async () => {
    db.supplierInvite.findUnique.mockResolvedValue(supplierInvite());
    db.user.findUnique.mockResolvedValue({ id: "u-existing" });

    const res = await registerSupplier(post("/api/auth/supplier/register", registration));

    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("ACCOUNT_EXISTS");
    expect(hashPassword).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.account.create).not.toHaveBeenCalled();
  });

  it("answers 429 before it reads the invite", async () => {
    limiter.rateLimitRequest.mockResolvedValueOnce(new Response(null, { status: 429 }));

    const res = await registerSupplier(post("/api/auth/supplier/register", registration));

    expect(res.status).toBe(429);
    expect(db.supplierInvite.findUnique).not.toHaveBeenCalled();
  });

  it("hashes the password and claims the invite in the same step for a new account", async () => {
    db.supplierInvite.findUnique.mockResolvedValue(supplierInvite());
    db.user.findUnique.mockResolvedValue(null);
    db.supplierInvite.updateMany.mockResolvedValue({ count: 1 });

    const res = await registerSupplier(post("/api/auth/supplier/register", registration));

    expect(res.status).toBe(201);
    expect(db.account.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ providerId: "credential", password: "hashed-password" }),
    });
    expect(db.organizationMembership.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizationId: "org-a", role: "supplier" }),
    });
  });
});
