// @vitest-environment node
/** The carrier scorecard reads only the organisation's own loads, notes and audit entries. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: {
    wasteRecord: { findMany: vi.fn() },
    wasteDocument: { findMany: vi.fn() },
    auditLog: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => db);

import { loadCarrierScorecard } from "@/lib/waste/scorecard-load";

beforeEach(() => {
  vi.clearAllMocks();
  db.prisma.wasteRecord.findMany.mockResolvedValue([]);
  db.prisma.wasteDocument.findMany.mockResolvedValue([{ id: "d1", issuer: "Acme", wasteRecordId: "wr1", extracted: null }]);
  db.prisma.auditLog.findMany.mockResolvedValue([{ resourceId: "d1", metadata: { changedFromSuggestion: 2 } }]);
});

describe("carrier scorecard tenancy", () => {
  it("scopes every read to the organisation", async () => {
    await loadCarrierScorecard("org-a");
    expect(db.prisma.wasteRecord.findMany.mock.calls[0][0].where).toEqual({ organizationId: "org-a" });
    expect(db.prisma.wasteDocument.findMany.mock.calls[0][0].where).toMatchObject({ organizationId: "org-a" });
    expect(db.prisma.auditLog.findMany.mock.calls[0][0].where).toMatchObject({ organizationId: "org-a", action: "waste_document.reviewed" });
  });

  it("reads changed-field counts only for the documents it was given", async () => {
    const rows = await loadCarrierScorecard("org-a");
    expect(db.prisma.auditLog.findMany.mock.calls[0][0].where.resourceId).toEqual({ in: ["d1"] });
    expect(rows[0].notesRecorded).toBe(1);
  });

  it("skips the audit read when nothing was recorded", async () => {
    db.prisma.wasteDocument.findMany.mockResolvedValue([{ id: "d2", issuer: "Acme", wasteRecordId: null, extracted: null }]);
    await loadCarrierScorecard("org-a");
    expect(db.prisma.auditLog.findMany).not.toHaveBeenCalled();
  });
});
