// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => {
  const model = () => ({ findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() });
  const prisma = {
    organizationMembership: model(),
    msRisk: model(),
    msPolicy: model(),
    msAudit: model(),
    msAuditFinding: model(),
    msCorrectiveAction: model(),
    msEvidenceLink: model(),
    msFrameworkAdoption: model(),
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  };
  return prisma;
});
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/session")>();
  const ctx = { session: { user: { id: "user-a" } }, membership: { role: "admin" } };
  return { ...actual, requireSession: vi.fn().mockResolvedValue(ctx.session), requireOrgMember: vi.fn().mockResolvedValue(ctx) };
});

import { applyRules, registerSchema } from "../registers/server";

const req = (body: unknown, method = "POST") =>
  new NextRequest("http://localhost/x", { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const listParams = (register: string) => ({ params: Promise.resolve({ orgId: "org-a", register }) });
const rowParams = (register: string, id: string) => ({ params: Promise.resolve({ orgId: "org-a", register, id }) });

beforeEach(() => {
  vi.clearAllMocks();
  for (const m of [db.msRisk, db.msPolicy, db.msAudit, db.msAuditFinding, db.msCorrectiveAction]) {
    m.create.mockImplementation(async ({ data }: { data: object }) => ({ id: "new-1", ...data }));
    m.update.mockImplementation(async ({ data }: { data: object }) => ({ id: "row-1", ...data }));
  }
});

describe("register validation", () => {
  it("requires required fields on create, rejects unknown fields and unknown frameworks", () => {
    const s = registerSchema("risks", "create");
    expect(s.safeParse({ likelihood: 3 }).success).toBe(false);
    expect(s.safeParse({ title: "Spill at depot", organizationId: "org-b" }).success).toBe(false);
    expect(s.safeParse({ title: "Spill", frameworks: ["iso-14001-2015"] }).success).toBe(true);
    expect(s.safeParse({ title: "Spill", frameworks: ["made-up"] }).success).toBe(false);
    expect(s.safeParse({ title: "Spill", likelihood: 6 }).success).toBe(false);
  });

  it("starts a new draft version when an approved policy's text changes", () => {
    const existing = { id: "p1", title: "Environmental policy", body: "v1", status: "approved", version: 2, approvedByUserId: "u1", approvedOn: new Date() };
    const { data } = applyRules("policies", existing, { body: "v2" }, "user-a");
    expect(data).toMatchObject({ status: "draft", version: 3, approvedByUserId: null, approvedOn: null });
    const approve = applyRules("policies", { ...existing, status: "draft" }, { status: "approved" }, "user-a");
    expect(approve.data).toMatchObject({ approvedByUserId: "user-a" });
  });

  it("will not close a corrective action without a note on whether it worked", () => {
    expect(applyRules("corrective-actions", { id: "c1", effectiveness: null }, { status: "closed" }, "u").error).toBeTruthy();
    expect(applyRules("corrective-actions", { id: "c1", effectiveness: null }, { status: "closed", effectiveness: "No repeat in 3 months" }, "u").error).toBeUndefined();
  });
});

describe("register routes", () => {
  it("creates rows in the caller's organisation only", async () => {
    const { POST } = await import("@/app/api/orgs/[orgId]/management-systems/registers/[register]/route");
    const res = await POST(req({ title: "Diesel spill", likelihood: 2, impact: 4 }), listParams("risks"));
    expect(res.status).toBe(201);
    expect(db.msRisk.create.mock.calls[0][0].data).toMatchObject({ organizationId: "org-a", createdByUserId: "user-a" });
  });

  it("refuses an owner from another organisation", async () => {
    const { POST } = await import("@/app/api/orgs/[orgId]/management-systems/registers/[register]/route");
    db.organizationMembership.findFirst.mockResolvedValue(null);
    const res = await POST(req({ title: "Diesel spill", ownerUserId: "user-of-org-b" }), listParams("risks"));
    expect(res.status).toBe(404);
    expect(db.msRisk.create).not.toHaveBeenCalled();
  });

  it("refuses a finding against another organisation's audit", async () => {
    const { POST } = await import("@/app/api/orgs/[orgId]/management-systems/registers/[register]/route");
    db.msAudit.findFirst.mockResolvedValue(null);
    const res = await POST(req({ auditId: "audit-of-org-b", description: "No calibration records" }), listParams("audit-findings"));
    expect(res.status).toBe(404);
    expect(db.msAudit.findFirst.mock.calls[0][0].where).toEqual({ id: "audit-of-org-b", organizationId: "org-a" });
    expect(db.msAuditFinding.create).not.toHaveBeenCalled();
  });

  it("updates and deletes only rows found inside the caller's organisation", async () => {
    const { PATCH, DELETE } = await import("@/app/api/orgs/[orgId]/management-systems/registers/[register]/[id]/route");
    db.msRisk.findFirst.mockResolvedValue(null);
    expect((await PATCH(req({ status: "closed" }, "PATCH"), rowParams("risks", "risk-of-org-b"))).status).toBe(404);
    expect((await DELETE(req({}, "DELETE"), rowParams("risks", "risk-of-org-b"))).status).toBe(404);
    expect(db.msRisk.findFirst.mock.calls[0][0].where).toEqual({ id: "risk-of-org-b", organizationId: "org-a" });
    expect(db.msRisk.update).not.toHaveBeenCalled();
    expect(db.msRisk.delete).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown register", async () => {
    const { GET } = await import("@/app/api/orgs/[orgId]/management-systems/registers/[register]/route");
    expect((await GET(new NextRequest("http://localhost/x"), listParams("secrets"))).status).toBe(404);
  });
});

describe("register rows as evidence", () => {
  it("links a register row only when it is the caller's", async () => {
    const { POST } = await import("@/app/api/orgs/[orgId]/management-systems/[slug]/requirements/[code]/evidence/route");
    db.msFrameworkAdoption.findUnique.mockResolvedValue({ id: "adopt-1" });
    db.msEvidenceLink.count.mockResolvedValue(0);
    db.msEvidenceLink.create.mockImplementation(async ({ data }: { data: object }) => ({ id: "link-1", ...data }));
    const params = { params: Promise.resolve({ orgId: "org-a", slug: "iso-14001-2015", code: "9.2.2" }) };

    db.msAudit.findFirst.mockResolvedValue(null);
    expect((await POST(req({ kind: "ms_audit", targetId: "audit-of-org-b" }), params)).status).toBe(404);

    db.msAudit.findFirst.mockResolvedValue({ id: "audit-a", title: "Q3 internal audit" });
    const res = await POST(req({ kind: "ms_audit", targetId: "audit-a" }), params);
    expect(res.status).toBe(201);
    expect(db.msEvidenceLink.create.mock.calls[0][0].data).toMatchObject({ label: "Q3 internal audit", kind: "ms_audit" });
  });
});
