// @vitest-environment node
/** Bulk approval of carrier transfer notes: org-scoped, only still-ready notes become records, one record per document. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => {
  const tx = { wasteDocument: { updateMany: vi.fn(), update: vi.fn() }, wasteRecord: { create: vi.fn() } };
  return {
    tx,
    prisma: {
      wasteDocument: { findMany: vi.fn() },
      wasteRecord: { findMany: vi.fn(), findFirst: vi.fn().mockResolvedValue(null) },
      reportingPeriod: { findMany: vi.fn() },
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    },
  };
});
vi.mock("@/lib/db", () => ({ prisma: db.prisma }));
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/calculation/environmental-metrics", () => ({ syncWasteRecordCalculation: vi.fn().mockResolvedValue(null), rebuildEnvironmentalMetricAggregates: vi.fn() }));
const session = vi.hoisted(() => ({ requireOrgMember: vi.fn(), AuthError: class AuthError extends Error {}, ROLE_GROUPS: { editor: ["admin"], projectManagers: ["project_manager"] } }));
vi.mock("@/lib/auth/session", () => session);
vi.mock("@/lib/security/org-refs", () => ({ orgRefsError: vi.fn().mockResolvedValue(null) }));

import { POST } from "@/app/api/orgs/[orgId]/waste/documents/bulk-accept/route";

const reading = { reference: "WTN1", carrier: "Acme", carrierRegistration: "CBDU123456", ewc: "17 09 04", tonnes: 7, date: "2026-10-01", found: 5, registerCheck: { status: "registered" } };
const doc = (id: string, extracted: unknown = reading) => ({ id, kind: "transfer_note", wasteRecordId: null, reference: null, issuer: null, projectId: null, extracted });
const past = (n: number) => Array.from({ length: n }, () => ({ carrierRegistration: "CBDU123456", carrierName: "Acme", ewcCode: "17 09 04", facilityId: "f1", wasteType: "Mixed", disposalRoute: "recycling_mixed", hazardous: false, destination: null, weightTonnes: 6, recordedAt: new Date("2026-08-01") }));
const call = (ids: string[]) => POST(new NextRequest("http://x/api", { method: "POST", body: JSON.stringify({ ids }) }), { params: Promise.resolve({ orgId: "org-a" }) });

beforeEach(() => {
  vi.clearAllMocks();
  session.requireOrgMember.mockResolvedValue({ session: { user: { id: "u1" } }, membership: { role: "admin" } });
  db.prisma.wasteRecord.findMany.mockImplementation(async (a: { select: Record<string, boolean> }) => (a.select.weightTonnes ? past(2) : []));
  db.prisma.reportingPeriod.findMany.mockResolvedValue([{ id: "p1", startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") }]);
  db.tx.wasteDocument.updateMany.mockResolvedValue({ count: 1 });
  db.tx.wasteRecord.create.mockResolvedValue({ id: "wr1" });
});

describe("bulk accept", () => {
  it("reads documents only inside the organisation and only unrecorded transfer notes", async () => {
    db.prisma.wasteDocument.findMany.mockResolvedValue([]);
    const res = await call(["doc-of-org-b"]);
    expect((await res.json()).skipped).toEqual([{ id: "doc-of-org-b", reasons: ["Not found or already recorded"] }]);
    expect(db.prisma.wasteDocument.findMany.mock.calls[0][0].where).toMatchObject({ organizationId: "org-a", kind: "transfer_note", wasteRecordId: null });
    expect(db.tx.wasteRecord.create).not.toHaveBeenCalled();
  });

  it("records a ready note and skips one that needs a look, with the reasons", async () => {
    db.prisma.wasteDocument.findMany.mockResolvedValue([doc("d1"), doc("d2", { ...reading, reference: "WTN2", registerCheck: { status: "not_found" } })]);
    const body = await (await call(["d1", "d2"])).json();
    expect(body.recorded).toBe(1);
    expect(body.skipped).toHaveLength(1);
    expect(body.skipped[0].id).toBe("d2");
    expect(body.skipped[0].reasons.join(" ")).toContain("not on the Environment Agency");
    expect(db.tx.wasteRecord.create).toHaveBeenCalledTimes(1);
    expect(db.tx.wasteRecord.create.mock.calls[0][0].data).toMatchObject({ organizationId: "org-a", facilityId: "f1", reportingPeriodId: "p1", weightTonnes: 7 });
  });

  it("does not record twice when another reviewer got there first", async () => {
    db.prisma.wasteDocument.findMany.mockResolvedValue([doc("d1")]);
    db.tx.wasteDocument.updateMany.mockResolvedValue({ count: 0 });
    const body = await (await call(["d1"])).json();
    expect(body.recorded).toBe(0);
    expect(db.tx.wasteRecord.create).not.toHaveBeenCalled();
  });

  it("skips a note whose reference became a record a moment ago", async () => {
    db.prisma.wasteDocument.findMany.mockResolvedValue([doc("d1")]);
    db.prisma.wasteRecord.findFirst.mockResolvedValueOnce({ id: "wr-other" });
    const body = await (await call(["d1"])).json();
    expect(body.recorded).toBe(0);
    expect(body.skipped[0].reasons).toEqual(["A waste record with this reference already exists"]);
    expect(db.tx.wasteRecord.create).not.toHaveBeenCalled();
  });

  it("refuses an empty or oversized list", async () => {
    expect((await call([])).status).toBe(422);
  });
});
