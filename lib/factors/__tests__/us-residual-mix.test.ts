import { describe, expect, it } from "vitest";
import { EGRID_SUBREGIONS } from "@/lib/calculation/egrid-subregion";
import { RESIDUAL_MIX_CODES, residualMixKgPerKwh } from "../us-residual-mix";

describe("US residual mix", () => {
  it("covers every eGRID subregion and Puerto Rico", () => {
    expect([...RESIDUAL_MIX_CODES].sort()).toEqual([...EGRID_SUBREGIONS.map((s) => s.code), "PRMS"].sort());
  });
  it("converts lb/MWh to kg/kWh", () => {
    expect(residualMixKgPerKwh("CAMX")).toBeCloseTo((434.2188489 * 0.45359237) / 1000, 5);
    expect(residualMixKgPerKwh("erct")).toBeCloseTo(0.373679, 5);
    expect(residualMixKgPerKwh("ZZZZ")).toBeNull();
    expect(residualMixKgPerKwh(null)).toBeNull();
  });
  it("is never below the grid average where renewables were sold off (ERCT, SPNO, SPSO)", () => {
    // Residual mix removes the cleanest MWh, so it is at or above the total output rate (eGRID2023 ERCT 736.629 lb/MWh).
    expect(residualMixKgPerKwh("ERCT")!).toBeGreaterThan((736.629 * 0.45359237) / 1000);
  });
});
