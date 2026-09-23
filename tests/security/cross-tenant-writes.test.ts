// @vitest-environment node
/**
 * Cross-tenant write regressions. Each case is a route that used to let one
 * organisation change something another organisation depends on. They must
 * refuse, or write only inside the caller's own org.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => {
  const model = () => ({
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  });
  const prisma = {
    organizationMembership: model(),
    platformMembership: model(),
    account: model(),
    user: model(),
    organization: model(),
    tenantBranding: model(),
    supplierInvite: model(),
    frameworkDatapoint: model(),
    organizationDatapointNarrative: model(),
    dsarRequest: model(),
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation((fn: (tx: typeof prisma) => unknown) => fn(prisma));
  return prisma;
});

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/jobs/dispatch", () => ({
  dispatchNotification: vi.fn().mockResolvedValue(undefined),
  dispatchDsarExport: vi.fn(),
  dispatchDsarErasure: vi.fn(),
}));
vi.mock("@/lib/notifications/email", () => ({ resolveEmailLogoUrl: vi.fn() }));
vi.mock("@/workers/supplier-invite-email", () => ({
  sendSupplierInviteEmail: vi.fn(),
  sendSupplierCredentialsEmail: vi.fn(),
}));
vi.mock("@/lib/security/rate-limit-async", () => ({ rateLimitRequest: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/session")>();
  const ctx = { session: { user: { id: "admin-a", name: "Admin A", email: "a@org-a.test" } }, membership: {} };
  return {
    ...actual,
    requireSession: vi.fn().mockResolvedValue(ctx.session),
    requireOrgMember: vi.fn().mockResolvedValue(ctx),
  };
});

const ORG_A = "org-a";
const ORG_B = "org-b";

function post(url: string, body: unknown, method = "POST") {
  return new NextRequest(`http://localhost${url}`, {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db));
});

describe("supplier password reset", () => {
  it("refuses when the supplier also belongs to another org, and changes nothing", async () => {
    const { POST } = await import("@/app/api/orgs/[orgId]/supplier-accounts/[userId]/reset-password/route");
    db.organizationMembership.findUnique.mockResolvedValue({ role: "supplier", terminatedAt: null });
    db.organizationMembership.count.mockResolvedValue(1); // admin in org B
    db.platformMembership.count.mockResolvedValue(0);

    const res = await POST(post("/x", {}), { params: Promise.resolve({ orgId: ORG_A, userId: "shared-user" }) });

    expect(res.status).toBe(409);
    expect(db.account.update).not.toHaveBeenCalled();
    expect(JSON.stringify(await res.json())).not.toMatch(/newPassword/);
  });

  it("resets with a password Better Auth can verify when the account is this org's alone", async () => {
    const { POST } = await import("@/app/api/orgs/[orgId]/supplier-accounts/[userId]/reset-password/route");
    const { verifyPassword } = await import("better-auth/crypto");
    db.organizationMembership.findUnique.mockResolvedValue({ role: "supplier", terminatedAt: null });
    db.organizationMembership.count.mockResolvedValue(0);
    db.platformMembership.count.mockResolvedValue(0);
    db.account.findFirst.mockResolvedValue({ id: "acc-1" });
    db.user.findUnique.mockResolvedValue({ email: "s@supplier.test" });

    const res = await POST(post("/x", {}), { params: Promise.resolve({ orgId: ORG_A, userId: "supplier-1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    const hash = db.account.update.mock.calls[0][0].data.password;
    expect(await verifyPassword({ hash, password: body.newPassword })).toBe(true);
  });
});

describe("supplier invite with credentials", () => {
  it("never sets a password on an account that already exists", async () => {
    const { POST } = await import("@/app/api/orgs/[orgId]/supplier-invites/route");
    db.organizationMembership.findFirst.mockResolvedValue(null);
    db.organization.findUnique.mockResolvedValue({ name: "Org A" });
    db.tenantBranding.findUnique.mockResolvedValue(null);
    db.user.findUnique.mockResolvedValue({ id: "admin-of-org-b" });
    db.supplierInvite.create.mockResolvedValue({
      id: "inv-1",
      email: "boss@org-b.test",
      companyName: null,
      token: "t",
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    const res = await POST(post("/x", { email: "boss@org-b.test", inviteMethod: "credentials" }), {
      params: Promise.resolve({ orgId: ORG_A }),
    });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.inviteMethod).toBe("magic-link");
    expect(db.account.update).not.toHaveBeenCalled();
    expect(db.account.create).not.toHaveBeenCalled();
  });
});

describe("supplier registration from an invite", () => {
  it("joins the invite's org, whatever org the request names", async () => {
    const { POST } = await import("@/app/api/auth/supplier/register/route");
    db.supplierInvite.findUnique.mockResolvedValue({
      id: "inv-1",
      email: "new@supplier.test",
      organizationId: ORG_A,
      expiresAt: new Date(Date.now() + 86_400_000),
      usedAt: null,
    });
    db.user.findUnique.mockResolvedValue(null);
    db.user.create.mockResolvedValue({ id: "u-new" });
    db.account.findFirst.mockResolvedValue(null);
    db.organizationMembership.findFirst.mockResolvedValue(null);

    await POST(
      post("/x", { email: "new@supplier.test", password: "a-long-password", inviteToken: "tok", organizationId: ORG_B }),
    );

    const orgs = db.organizationMembership.create.mock.calls.map((c) => c[0].data.organizationId);
    expect(orgs).toEqual([ORG_A]);
  });
});

describe("datapoint narratives", () => {
  it("stores the narrative against the caller's org, not the shared datapoint", async () => {
    const { PATCH } = await import("@/app/api/orgs/[orgId]/compliance/datapoints/[datapointId]/narrative/route");
    db.frameworkDatapoint.findUnique.mockResolvedValue({
      id: "dp-1",
      framework: "ESRS",
      code: "E1-6",
      title: "GHG",
      narratives: [],
    });

    const res = await PATCH(post("/x", { publicNarrative: "Our disclosure" }, "PATCH"), {
      params: Promise.resolve({ orgId: ORG_A, datapointId: "dp-1" }),
    });

    expect(res.status).toBe(200);
    expect(db.frameworkDatapoint.update).not.toHaveBeenCalled();
    expect(db.organizationDatapointNarrative.upsert.mock.calls[0][0].create.organizationId).toBe(ORG_A);
    const read = db.frameworkDatapoint.findUnique.mock.calls[0][0].select.narratives.where;
    expect(read).toEqual({ organizationId: ORG_A });
  });
});

describe("shared factor and material libraries", () => {
  it.each([
    ["factors", "@/app/api/orgs/[orgId]/factors/import/route"],
    ["materials", "@/app/api/orgs/[orgId]/materials/import/route"],
  ])("an org editor without platform access cannot import %s", async (_name, path) => {
    const { POST } = await import(/* @vite-ignore */ path);
    db.platformMembership.findUnique.mockResolvedValue(null);

    const res = await POST(new NextRequest("http://localhost/x", { method: "POST", body: new FormData() }), {
      params: Promise.resolve({ orgId: ORG_A }),
    });

    expect(res.status).toBe(403);
  });

  it("platform analysts are read-only too", async () => {
    const { canEditSharedLibraries } = await import("@/lib/auth/shared-libraries");
    db.platformMembership.findUnique.mockResolvedValue({ role: "platform_analyst" });
    expect(await canEditSharedLibraries("u")).toBe(false);
    db.platformMembership.findUnique.mockResolvedValue({ role: "platform_support" });
    expect(await canEditSharedLibraries("u")).toBe(true);
  });
});

describe("data subject requests", () => {
  it("cannot be filed against an org the requester does not belong to", async () => {
    const { POST } = await import("@/app/api/account/dsar/route");
    db.organizationMembership.findUnique.mockResolvedValue(null);

    const res = await POST(post("/x", { type: "export", organizationId: ORG_B }));

    expect(res.status).toBe(403);
    expect(db.dsarRequest.create).not.toHaveBeenCalled();
  });
});
