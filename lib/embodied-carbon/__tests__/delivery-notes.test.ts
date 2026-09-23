// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  computeDeliveryEmbodied,
  matchMaterial,
  pickSupplierEpd,
  recordDeliveryEmbodiedCarbon,
} from "../delivery-notes";
import { approveSubmissionInTx, type ApprovableSubmission } from "@/lib/field-submissions/approve";

const lib = [
  ["Ready Mix Concrete (25 MPa, 300 kg/m3 cement)", "concrete", "kg", 2400],
  ["Reinforcing Bar (rebar, recycled)", "steel", "kg", null],
  ["Structural Steel (virgin, UK EAF)", "steel", "kg", null],
  ["Rigid PIR / PUR Board", "insulation", "kg", 32],
  ["Aerated Concrete Block (AAC)", "masonry", "kg", 650],
  ["Dense Aggregate Block", "masonry", "kg", 2100],
  ["Mineral Wool (glass)", "insulation", "kg", 25],
  ["Float Glass", "glass", "kg", 2500],
  ["Plasterboard (standard)", "finishes", "kg", 800],
  ["Gypsum Plaster", "finishes", "kg", null],
  ["Double-Glazed Unit (standard low-e)", "glass", "m2", null],
  ["Aggregates (primary)", "aggregates", "kg", null],
  ["Aggregates (recycled)", "aggregates", "kg", null],
  ["Asphalt (primary)", "asphalt", "kg", null],
  ["Asphalt (recycled content)", "asphalt", "kg", null],
  ["Plywood", "timber", "kg", 530],
].map(([name, category, declaredUnit, density], i) => ({
  id: `m${i}`,
  name: name as string,
  category: category as string,
  declaredUnit: declaredUnit as string,
  density: density as number | null,
}));
const nameOf = (text: string) => matchMaterial(text, lib).material?.name ?? null;

describe("material matching", () => {
  it("recognises what delivery notes actually say", () => {
    expect(nameOf("C32/40 Readymix concrete")).toBe("Ready Mix Concrete (25 MPa, 300 kg/m3 cement)");
    expect(nameOf("B500B 12mm rebar")).toBe("Reinforcing Bar (rebar, recycled)");
    expect(nameOf("Kingspan TP10 120mm")).toBe("Rigid PIR / PUR Board");
    expect(nameOf("Celcon Standard blocks 100mm")).toBe("Aerated Concrete Block (AAC)");
    expect(nameOf("7N dense concrete blocks")).toBe("Dense Aggregate Block");
    expect(nameOf("Isover glass wool loft roll")).toBe("Mineral Wool (glass)");
    expect(nameOf("Gyproc plasterboard 12.5mm")).toBe("Plasterboard (standard)");
    expect(nameOf("UB 203x133x25 beams")).toBe("Structural Steel (virgin, UK EAF)");
    expect(nameOf("C32/40 ready-mix, 20mm aggregate")).toBe("Ready Mix Concrete (25 MPa, 300 kg/m3 cement)");
  });

  it("tells primary from recycled aggregates and asphalt", () => {
    expect(nameOf("Recycled concrete aggregate 6F2")).toBe("Aggregates (recycled)");
    expect(nameOf("Crushed concrete hardcore")).toBe("Aggregates (recycled)");
    expect(nameOf("Type 1 MOT sub-base")).toBe("Aggregates (primary)");
    expect(nameOf("Sharp sand")).toBe("Aggregates (primary)");
    expect(nameOf("7N dense aggregate blocks")).toBe("Dense Aggregate Block");
    expect(nameOf("20mm dense bitmac / tarmac")).toBe("Asphalt (primary)");
    expect(nameOf("AC 10 surface course, 30% RAP")).toBe("Asphalt (recycled content)");
    expect(nameOf("18mm plywood")).toBe("Plywood");
    expect(matchMaterial("Type 1 MOT sub-base", lib).reason).toContain("primary aggregate factor");
  });

  it("says so, rather than guessing, when the library has no factor", () => {
    const m = matchMaterial("Screened topsoil", lib);
    expect(m.material).toBeNull();
    expect(m.reason).toContain("topsoil");
    expect(nameOf("Assorted fixings")).toBeNull();
    expect(matchMaterial("", lib).reason).toContain("no material description");
  });

  it("notes the conservative choice when the grade is not stated", () => {
    expect(matchMaterial("steel beams", lib).reason).toContain("higher virgin-steel factor");
  });
});

const concrete = { gwpA1A3: 0.11, declaredUnit: "kg", density: 2400 };
const hgv = { externalId: "defra-2026-hgv-avg-tkm", kgCo2ePerTonneKm: 0.10356, library: "DEFRA 2026.1" };

describe("delivery calculation", () => {
  it("uses the actual route for A4", () => {
    const r = computeDeliveryEmbodied({ quantity: 6, unit: "m³", factors: concrete, factorSource: "ICE", distanceKm: 20, hgv });
    if (!r.ok) throw new Error(r.reason);
    expect(r.a1a3Kg).toBeCloseTo(6 * 2400 * 0.11); // 1,584
    expect(r.a4Kg).toBeCloseTo(14.4 * 20 * 0.10356); // 29.83
    expect(r.totalKgCo2e).toBeCloseTo(1584 + 29.825, 2);
    expect(r.stages).toEqual(["A1-A3", "A4"]);
    expect(r.notes).toContain("defra-2026-hgv-avg-tkm");
  });

  it("falls back to the factor's generic A4, or leaves A4 out, when no route was recorded", () => {
    const generic = computeDeliveryEmbodied({ quantity: 2, unit: "tonnes", factors: { ...concrete, gwpA4: 0.005 }, factorSource: "ICE", distanceKm: null, hgv });
    expect(generic.ok && generic.a4Kg).toBeCloseTo(2000 * 0.005);
    const none = computeDeliveryEmbodied({ quantity: 2, unit: "t", factors: concrete, factorSource: "ICE", distanceKm: null, hgv });
    expect(none.ok && none.stages).toEqual(["A1-A3"]);
  });

  it("refuses quantities it cannot convert", () => {
    expect(computeDeliveryEmbodied({ quantity: 40, unit: "bags", factors: concrete, factorSource: "ICE", distanceKm: 5, hgv }))
      .toMatchObject({ ok: false });
    expect(computeDeliveryEmbodied({ quantity: 30, unit: "m2", factors: { gwpA1A3: 0.39, declaredUnit: "kg", density: 800 }, factorSource: "ICE", distanceKm: 5, hgv }))
      .toMatchObject({ ok: false });
    expect(computeDeliveryEmbodied({ quantity: 3, unit: "m3", factors: { gwpA1A3: 0.82, declaredUnit: "kg", density: null }, factorSource: "ICE", distanceKm: 5, hgv }))
      .toMatchObject({ ok: false });
  });
});

describe("supplier EPDs", () => {
  const epd = { materialId: "m0", manufacturer: "Hanson UK", validFrom: new Date("2024-01-01"), validUntil: new Date("2029-01-01") };
  it("apply only to the same material from the same supplier, while valid", () => {
    const date = new Date("2026-05-01");
    expect(pickSupplierEpd([epd], "m0", "Hanson Ltd", date)).toBe(epd);
    expect(pickSupplierEpd([epd], "m0", "Tarmac", date)).toBeNull();
    expect(pickSupplierEpd([epd], "m1", "Hanson", date)).toBeNull();
    expect(pickSupplierEpd([epd], "m0", "Hanson", new Date("2030-01-01"))).toBeNull();
    expect(pickSupplierEpd([epd], "m0", null, date)).toBeNull();
  });
});

function fakeTx() {
  const tx = {
    embodiedCarbonRecord: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "ecr1" }) },
    embodiedMaterial: { findMany: vi.fn().mockResolvedValue(lib.map((m) => ({ ...m, gwpA1A3: m.id === "m0" ? 0.11 : 1, gwpA4: null, gwpA5: null, gwpC1C4: null, gwpC1: null, gwpC2: null, gwpC3: null, gwpC4: null, gwpD: null, source: "ICE v3.0" }))) },
    epdRecord: { findMany: vi.fn().mockResolvedValue([]) },
    factorLibrary: { findMany: vi.fn().mockResolvedValue([{ id: "lib26", name: "DEFRA", version: "2026.1" }]) },
    emissionFactor: { findFirst: vi.fn().mockResolvedValue({ externalId: "defra-2026-hgv-avg-tkm", co2e: 0.10356 }) },
    site: { findFirst: vi.fn().mockResolvedValue({ projectId: "proj-a" }) },
    activityRecord: { create: vi.fn().mockResolvedValue({ id: "ar1" }) },
    activityRecordEvidence: { createMany: vi.fn() },
    fieldSubmission: { update: vi.fn().mockResolvedValue({ id: "fs1" }) },
  };
  return tx;
}

describe("recording on approval", () => {
  const submission = { id: "fs1", siteId: "site-a", reportingPeriodId: "p1", calculatedDistanceKm: 20 };

  it("creates the org's record against the site's project", async () => {
    const tx = fakeTx();
    const out = await recordDeliveryEmbodiedCarbon(tx as never, {
      orgId: "org-a", submission, formData: { materialType: "C32/40 concrete", supplierName: "Hanson" },
      quantity: 6, unit: "m3", activityDate: new Date("2026-05-01"), userId: "u1",
    });
    expect(out.recordId).toBe("ecr1");
    const data = tx.embodiedCarbonRecord.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ organizationId: "org-a", projectId: "proj-a", materialId: "m0", source: "delivery_note", fieldSubmissionId: "fs1", lifecycleStages: ["A1-A3", "A4"] });
    expect(data.totalKgCo2e).toBeCloseTo(1584 + 29.825, 2);
    expect(tx.site.findFirst.mock.calls[0][0].where).toEqual({ id: "site-a", organizationId: "org-a" });
    expect(tx.epdRecord.findMany.mock.calls[0][0].where.organizationId).toBe("org-a");
    expect(tx.embodiedCarbonRecord.findFirst.mock.calls[0][0].where.organizationId).toBe("org-a");
  });

  it("records nothing when the reviewer opts out, or the material is not in the library", async () => {
    const tx = fakeTx();
    const base = { orgId: "org-a", submission, quantity: 10, unit: "t", activityDate: new Date(), userId: "u1" };
    expect(await recordDeliveryEmbodiedCarbon(tx as never, { ...base, formData: { materialType: "concrete" }, materialId: null }))
      .toMatchObject({ recordId: null });
    expect(await recordDeliveryEmbodiedCarbon(tx as never, { ...base, formData: { materialType: "Screened topsoil" } }))
      .toMatchObject({ recordId: null });
    expect(tx.embodiedCarbonRecord.create).not.toHaveBeenCalled();
  });

  it("runs when a delivery note is approved", async () => {
    const tx = fakeTx();
    const result = await approveSubmissionInTx(tx as never, {
      orgId: "org-a",
      submission: {
        id: "fs1", documentType: "delivery_note", activityRecordId: null, reportingPeriodId: "p1", siteId: "site-a", contractId: null,
        facilityId: null, calculatedDistanceKm: 20, deviceSubmittedAt: new Date("2026-05-01"),
        formData: { materialType: "C32/40 concrete", quantity: 6, quantityUnit: "m3" }, ocrExtractedData: null, files: [],
      } as unknown as ApprovableSubmission,
      emissionCategoryId: "cat-s3-goods",
      reviewerUserId: "u1",
    });
    expect(result.embodied).toMatchObject({ recordId: "ecr1" });
  });
});
