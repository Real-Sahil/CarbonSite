// @vitest-environment node
/** Committing an import asks before writing a row that matches an existing record; a confirmed commit writes it. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => {
  const tx = {
    importBatch: { updateMany: vi.fn() },
    activityRecord: { createMany: vi.fn() },
  };
  return {
    tx,
    prisma: {
      importBatch: { findUnique: vi.fn() },
      stagedActivityRecord: { findMany: vi.fn() },
      activityRecord: { findMany: vi.fn() },
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    },
  };
});
vi.mock("@/lib/db", () => ({ prisma: db.prisma }));
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/billing/limits", () => ({ requireActiveBilling: vi.fn(), requireWithinUsageLimit: vi.fn() }));
vi.mock("@/lib/billing/usage", () => ({ recordUsage: vi.fn() }));
const session = vi.hoisted(() => ({
  requireOrgMember: vi.fn(),
  ROLE_GROUPS: { editor: ["admin"] },
}));
vi.mock("@/lib/auth/session", () => session);

import { POST } from "@/app/api/orgs/[orgId]/imports/[importId]/commit/route";

const staged = {
  id: "s1",
  data: { emissionCategoryId: "s1-stationary", amount: 120, unit: "kWh", activityDate: "2026-05-01", facilityId: "fac-a", supplierName: "Acme" },
};
const existing = (amount: number) => ({
  id: "rec-1",
  emissionCategoryId: "s1-stationary",
  amount,
  unit: "kWh",
  activityDate: new Date("2026-05-01T00:00:00.000Z"),
  facilityId: "fac-a",
  supplierName: "Acme",
});
const call = (body?: unknown) =>
  POST(
    new NextRequest("http://x/api", { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
    { params: Promise.resolve({ orgId: "org-a", importId: "imp1" }) },
  );

beforeEach(() => {
  vi.clearAllMocks();
  session.requireOrgMember.mockResolvedValue({ session: { user: { id: "u1" } }, membership: { role: "admin" } });
  db.prisma.importBatch.findUnique.mockResolvedValue({ id: "imp1", organizationId: "org-a", reportingPeriodId: "per-a", state: "ready_to_commit", templateKey: "generic" });
  db.prisma.stagedActivityRecord.findMany.mockResolvedValue([staged]);
  db.prisma.activityRecord.findMany.mockResolvedValue([]);
  db.tx.importBatch.updateMany.mockResolvedValue({ count: 1 });
  db.tx.activityRecord.createMany.mockResolvedValue({ count: 1 });
});

describe("commit asks before writing a duplicate", () => {
  it("refuses with 409 when a row matches an existing record, and writes nothing", async () => {
    db.prisma.activityRecord.findMany.mockResolvedValue([existing(120)]);
    const res = await call();
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "POSSIBLE_DUPLICATE", details: { count: 1 } });
    expect(db.tx.importBatch.updateMany).not.toHaveBeenCalled();
    expect(db.tx.activityRecord.createMany).not.toHaveBeenCalled();
    expect(db.prisma.activityRecord.findMany.mock.calls[0][0].where).toMatchObject({
      organizationId: "org-a",
      reviewStatus: { not: "rejected" },
    });
  });

  it("commits the matching rows once the person confirms", async () => {
    db.prisma.activityRecord.findMany.mockResolvedValue([existing(120)]);
    const res = await call({ allowDuplicate: true });
    expect(res.status).toBe(200);
    expect(db.tx.activityRecord.createMany).toHaveBeenCalledOnce();
    expect(db.tx.activityRecord.createMany.mock.calls[0][0].data).toHaveLength(1);
  });

  it("commits without asking when nothing matches", async () => {
    db.prisma.activityRecord.findMany.mockResolvedValue([existing(99)]);
    const res = await call();
    expect(res.status).toBe(200);
    expect(db.tx.activityRecord.createMany).toHaveBeenCalledOnce();
  });
});
