import { describe, expect, it } from "vitest";
import { allocateInstruments, type InstrumentInput, type MarketRecordInput } from "../scope2-instruments";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const YEAR = { validFrom: d("2026-01-01"), validTo: d("2026-12-31") };

function inst(id: string, over: Partial<InstrumentInput>): InstrumentInput {
  return { id, type: "rego", facilityId: null, coveredKwh: null, factorKgPerKwh: 0, reference: null, supplierName: null, ...YEAR, ...over };
}
function rec(id: string, kwh: number, date: string, facilityId: string | null = "site-1"): MarketRecordInput {
  return { id, kwh, activityDate: d(date), facilityId };
}

describe("market-based Scope 2 instrument allocation", () => {
  it("never claims a certificate twice, drawing down in date order", () => {
    const out = allocateInstruments(
      [rec("feb", 600, "2026-02-01"), rec("jan", 600, "2026-01-01")],
      [inst("rego", { coveredKwh: 1000 }), inst("residual", { type: "residual_mix", factorKgPerKwh: 0.4 })],
    );
    expect(out.get("jan")!.portions.map((p) => [p.instrumentId, p.kwh])).toEqual([["rego", 600]]);
    expect(out.get("feb")!.portions.map((p) => [p.instrumentId, p.kwh])).toEqual([
      ["rego", 400],
      ["residual", 200],
    ]);
    expect(out.get("feb")!.instrumentCo2eKg).toBeCloseTo(80);
    expect(out.get("feb")!.uncoveredKwh).toBe(0);
  });

  it("follows the quality hierarchy regardless of input order", () => {
    const out = allocateInstruments(
      [rec("r", 100, "2026-03-01")],
      [
        inst("resid", { type: "residual_mix", factorKgPerKwh: 0.4 }),
        inst("supplier", { type: "supplier_specific", factorKgPerKwh: 0.2 }),
        inst("tariff", { type: "green_tariff", coveredKwh: 30 }),
        inst("ppa", { type: "ppa", coveredKwh: 50 }),
      ],
    );
    expect(out.get("r")!.portions.map((p) => [p.instrumentId, p.kwh])).toEqual([
      ["ppa", 50],
      ["tariff", 30],
      ["supplier", 20],
    ]);
    expect(out.get("r")!.instrumentCo2eKg).toBeCloseTo(4);
  });

  it("uses a facility's own contract before an organisation-wide one", () => {
    const out = allocateInstruments(
      [rec("r", 10, "2026-03-01")],
      [inst("org", { coveredKwh: 100 }), inst("site", { facilityId: "site-1", coveredKwh: 100 })],
    );
    expect(out.get("r")!.portions[0].instrumentId).toBe("site");
  });

  it("ignores instruments for another facility or outside their validity window", () => {
    const out = allocateInstruments(
      [rec("r", 10, "2027-01-05")],
      [inst("other", { facilityId: "site-2" }), inst("expired", {})],
    );
    expect(out.has("r")).toBe(false);
  });

  it("leaves the uncovered share for the factor library", () => {
    const out = allocateInstruments([rec("r", 100, "2026-03-01")], [inst("rego", { coveredKwh: 25 })]);
    expect(out.get("r")).toMatchObject({ coveredKwh: 25, uncoveredKwh: 75, instrumentCo2eKg: 0 });
  });

  it("is deterministic whatever order records arrive in", () => {
    const records = [rec("a", 70, "2026-01-01"), rec("b", 70, "2026-01-01"), rec("c", 70, "2026-01-02")];
    const instruments = [inst("rego", { coveredKwh: 100 })];
    const first = allocateInstruments(records, instruments);
    const second = allocateInstruments([...records].reverse(), instruments);
    expect([...second.entries()].sort()).toEqual([...first.entries()].sort());
  });
});
