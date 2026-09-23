// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ wasteRecord: { findMany: vi.fn() }, supplierProfile: { findMany: vi.fn() } }));
vi.mock("@/lib/db", () => ({ prisma: db }));

import { loadWasteRegister, registerToCsv } from "../register";

const rec = (id: string, route: string, t: number, extra: Record<string, unknown> = {}) => ({
  id, recordedAt: new Date("2026-03-10"), wasteType: "Mixed C&D", ewcCode: "170904", hazardous: false,
  weightTonnes: t, disposalRoute: route, carrierName: "Acme", carrierRegistration: "CBDU1", transferNoteReference: "WTN1",
  destination: "Site", vehicleRegistration: null, facility: { id: "f1", name: "Depot" }, ...extra,
});

describe("waste register", () => {
  db.supplierProfile.findMany.mockResolvedValue([{ wasteCarrierRegistration: "CBDU1", wasteCarrierExpiresAt: new Date("2027-01-01"), supplierName: "Acme" }]);
  db.wasteRecord.findMany.mockResolvedValue([
    rec("a", "recycling_mixed", 6),
    rec("b", "incineration_efw", 1),
    rec("c", "landfill_mixed", 3, { transferNoteReference: null }),
  ]);

  it("counts recycling and energy recovery as diverted, and flags gaps", async () => {
    const r = await loadWasteRegister("org", {});
    expect(r.summary).toMatchObject({ transfers: 3, complete: 2, gaps: 1, tonnes: 10 });
    expect(r.summary.diversionRate).toBeCloseTo(0.7);
    expect(r.sites[0]).toMatchObject({ name: "Depot", gaps: 1, transfers: 3 });
  });

  it("filters to gaps only without changing the summary, and scopes queries to the org", async () => {
    const r = await loadWasteRegister("org", { gapsOnly: true });
    expect(r.rows.map((x) => x.id)).toEqual(["c"]);
    expect(r.summary.transfers).toBe(3);
    expect(db.wasteRecord.findMany.mock.calls.at(-1)![0].where.organizationId).toBe("org");
    expect(db.supplierProfile.findMany.mock.calls.at(-1)![0].where.organizationId).toBe("org");
  });

  it("exports one CSV row per transfer with the issues spelled out", async () => {
    const { rows } = await loadWasteRegister("org", { gapsOnly: true });
    const csv = registerToCsv(rows).split("\n");
    expect(csv).toHaveLength(2);
    expect(csv[1]).toContain("17 09 04");
    expect(csv[1]).toContain("No waste transfer note reference.");
  });
});
