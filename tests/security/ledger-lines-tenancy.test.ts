// @vitest-environment node
/**
 * Ledger lines come only from the caller's organisation: every read is scoped to it, and a line id
 * from another organisation stages nothing and marks nothing.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  prisma: {
    xeroSyncLog: { findMany: vi.fn(), updateMany: vi.fn() },
    invoiceRecord: { findMany: vi.fn() },
    activityRecord: { groupBy: vi.fn() },
    emissionCategory: { findMany: vi.fn() },
    organization: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => db);
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/billing/limits", () => ({ requireFeature: vi.fn(async () => null) }));
vi.mock("@/lib/auth/session", () => ({
  AuthError: class AuthError extends Error {},
  requireOrgMember: vi.fn(async () => ({ session: { user: { id: "u1" } }, membership: { role: "admin" } })),
  ROLE_GROUPS: { editor: ["admin"] },
}));
const stage = vi.hoisted(() => vi.fn());
vi.mock("@/lib/connectors/ingest", () => ({ stageConnectorRecords: stage }));

import { POST } from "@/app/api/orgs/[orgId]/integrations/xero/suggestions/route";

beforeEach(() => {
  vi.clearAllMocks();
  db.prisma.activityRecord.groupBy.mockResolvedValue([]);
  db.prisma.emissionCategory.findMany.mockResolvedValue([]);
  db.prisma.invoiceRecord.findMany.mockResolvedValue([]);
  db.prisma.organization.findUnique.mockResolvedValue({ reportingCurrency: "GBP" });
});

describe("ledger lines tenancy", () => {
  it("reads sync logs only inside the org, so another org's line id is not found and nothing is staged", async () => {
    db.prisma.xeroSyncLog.findMany.mockResolvedValue([]); // the org-scoped query returns nothing for a foreign id
    const res = await POST(
      new NextRequest("http://x/api", {
        method: "POST",
        body: JSON.stringify({ reportingPeriodId: "p1", lines: [{ id: "line-of-org-b", categoryCode: "s3-purchased-goods" }] }),
      }),
      { params: Promise.resolve({ orgId: "org-a" }) },
    );
    expect(res.status).toBe(422);
    expect(db.prisma.xeroSyncLog.findMany.mock.calls[0][0].where).toMatchObject({ organizationId: "org-a" });
    expect(stage).not.toHaveBeenCalled();
    expect(db.prisma.xeroSyncLog.updateMany).not.toHaveBeenCalled();
  });

  it("marks lines staged only inside the org and only after the batch was accepted", async () => {
    db.prisma.xeroSyncLog.findMany.mockResolvedValue([
      { id: "l1", invoiceId: "i1", invoiceNumber: "INV-1", supplierName: "Tarmac", lineDescription: "Concrete", amount: 100, processedAt: new Date() },
    ]);
    stage.mockResolvedValue(new Response("{}", { status: 202 }));
    await POST(
      new NextRequest("http://x/api", {
        method: "POST",
        body: JSON.stringify({ reportingPeriodId: "p1", lines: [{ id: "l1", categoryCode: "s3-purchased-goods" }] }),
      }),
      { params: Promise.resolve({ orgId: "org-a" }) },
    );
    expect(db.prisma.xeroSyncLog.updateMany).toHaveBeenCalledWith({
      where: { organizationId: "org-a", id: { in: ["l1"] } },
      data: { status: "staged" },
    });

    // A refused batch leaves the lines available.
    db.prisma.xeroSyncLog.updateMany.mockClear();
    stage.mockResolvedValue(new Response("{}", { status: 409 }));
    await POST(
      new NextRequest("http://x/api", {
        method: "POST",
        body: JSON.stringify({ reportingPeriodId: "p1", lines: [{ id: "l1", categoryCode: "s3-purchased-goods" }] }),
      }),
      { params: Promise.resolve({ orgId: "org-a" }) },
    );
    expect(db.prisma.xeroSyncLog.updateMany).not.toHaveBeenCalled();
  });

  it("refuses a category outside the seeded list", async () => {
    const res = await POST(
      new NextRequest("http://x/api", {
        method: "POST",
        body: JSON.stringify({ reportingPeriodId: "p1", lines: [{ id: "l1", categoryCode: "s9-made-up" }] }),
      }),
      { params: Promise.resolve({ orgId: "org-a" }) },
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(stage).not.toHaveBeenCalled();
  });
});
