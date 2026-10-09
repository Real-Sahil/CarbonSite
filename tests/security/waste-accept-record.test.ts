// @vitest-environment node
/** Turning a carrier's transfer note into a waste record: ids stay inside the organisation, one record per document, duplicates are flagged. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => {
  const tx = {
    wasteDocument: { updateMany: vi.fn(), update: vi.fn() },
    wasteRecord: { create: vi.fn() },
  };
  return {
    tx,
    prisma: {
      wasteDocument: { findFirst: vi.fn() },
      wasteRecord: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
      reportingPeriod: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    },
  };
});
vi.mock("@/lib/db", () => ({ prisma: db.prisma }));
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/calculation/environmental-metrics", () => ({
  syncWasteRecordCalculation: vi.fn().mockResolvedValue({ co2eTonnes: 1.2 }),
  rebuildEnvironmentalMetricAggregates: vi.fn(),
}));
const session = vi.hoisted(() => ({
  requireOrgMember: vi.fn(),
  AuthError: class AuthError extends Error {},
  ROLE_GROUPS: { editor: ["admin"], projectManagers: ["project_manager"] },
}));
vi.mock("@/lib/auth/session", () => session);
vi.mock("@/lib/security/org-refs", () => ({
  orgRefsError: vi.fn(async (_o: string, r: { facilityId?: string; projectId?: string | null }) =>
    r.facilityId === "fac-of-org-b" || r.projectId === "proj-of-org-b" ? new Response(JSON.stringify({ code: "NOT_FOUND" }), { status: 404 }) : null),
}));

import { POST } from "@/app/api/orgs/[orgId]/waste/documents/[id]/accept-record/route";

const good = { facilityId: "fac-a", reportingPeriodId: "per-a", wasteType: "Mixed", disposalRoute: "recycling_mixed", weightTonnes: 3.4, recordedAt: "2026-05-01", transferNoteReference: "HC-1" };
const call = (body: unknown, id = "d1") => POST(new NextRequest("http://x/api", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ orgId: "org-a", id }) });

beforeEach(() => {
  vi.clearAllMocks();
  session.requireOrgMember.mockResolvedValue({ session: { user: { id: "u1" } }, membership: { role: "admin" } });
  db.prisma.wasteDocument.findFirst.mockResolvedValue({ id: "d1", kind: "transfer_note", wasteRecordId: null });
  db.prisma.wasteRecord.findFirst.mockResolvedValue(null);
  db.tx.wasteDocument.updateMany.mockResolvedValue({ count: 1 });
  db.tx.wasteRecord.create.mockResolvedValue({ id: "wr1" });
});

describe("accept a transfer note as a waste record", () => {
  it("finds the document only inside the organisation", async () => {
    db.prisma.wasteDocument.findFirst.mockResolvedValue(null);
    expect((await call(good, "doc-of-org-b")).status).toBe(404);
    expect(db.prisma.wasteDocument.findFirst.mock.calls[0][0].where).toEqual({ id: "doc-of-org-b", organizationId: "org-a" });
    expect(db.tx.wasteRecord.create).not.toHaveBeenCalled();
  });

  it("refuses another organisation's facility or project", async () => {
    expect((await call({ ...good, facilityId: "fac-of-org-b" })).status).toBe(404);
    expect((await call({ ...good, projectId: "proj-of-org-b" })).status).toBe(404);
    expect(db.tx.wasteRecord.create).not.toHaveBeenCalled();
  });

  it("only turns a transfer note into a record", async () => {
    db.prisma.wasteDocument.findFirst.mockResolvedValue({ id: "d1", kind: "carrier_licence", wasteRecordId: null });
    expect((await call(good)).status).toBe(422);
  });

  it("creates one record in the organisation and links it", async () => {
    const res = await call(good);
    expect(res.status).toBe(201);
    expect(db.tx.wasteRecord.create.mock.calls[0][0].data).toMatchObject({ organizationId: "org-a", facilityId: "fac-a", weightTonnes: 3.4, transferNoteReference: "HC-1" });
    expect(db.tx.wasteDocument.update.mock.calls[0][0].data).toEqual({ wasteRecordId: "wr1" });
  });

  it("will not make a second record from the same document", async () => {
    db.prisma.wasteDocument.findFirst.mockResolvedValue({ id: "d1", kind: "transfer_note", wasteRecordId: "wr1" });
    expect((await call(good)).status).toBe(409);
    db.prisma.wasteDocument.findFirst.mockResolvedValue({ id: "d1", kind: "transfer_note", wasteRecordId: null });
    db.tx.wasteDocument.updateMany.mockResolvedValue({ count: 0 }); // a second reviewer got there first
    expect((await call(good)).status).toBe(409);
    expect(db.tx.wasteRecord.create).not.toHaveBeenCalled();
  });

  it("flags a transfer note reference already on a record unless told to allow it", async () => {
    db.prisma.wasteRecord.findFirst.mockResolvedValue({ id: "other" });
    const res = await call(good);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("POSSIBLE_DUPLICATE");
    expect((await call({ ...good, allowDuplicate: true })).status).toBe(201);
  });

  it("refuses fields the form cannot set", async () => {
    expect((await call({ ...good, organizationId: "org-b" })).status).toBeGreaterThanOrEqual(400);
  });
});
