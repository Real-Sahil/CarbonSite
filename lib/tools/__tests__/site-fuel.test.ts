import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SITE_FUELS, fuelById, fuelTonnes } from "@/lib/tools/site-fuel";

type Row = { externalId: string; co2e: number; inputUnit: string };
const library = JSON.parse(readFileSync(join(process.cwd(), "prisma/data/defra-2026-factors.json"), "utf8")) as { factors: Row[] };

describe("site fuel calculator factors", () => {
  it("matches the loaded DEFRA 2026 library, per litre", () => {
    for (const fuel of SITE_FUELS) {
      const row = library.factors.find((f) => f.externalId === fuel.externalId);
      expect(row, fuel.externalId).toBeDefined();
      expect(row!.inputUnit).toBe("litre");
      expect(fuel.kgCo2ePerLitre).toBe(row!.co2e);
    }
  });

  it("reproduces the worked example in the fuel guide", () => {
    expect(fuelTonnes(18000, fuelById("gas-oil")!)).toBeCloseTo(49.6, 1);
    expect(fuelTonnes(4000, fuelById("diesel")!)).toBeCloseTo(10.3, 1);
  });

  it("counts a missing or negative quantity as zero", () => {
    const diesel = fuelById("diesel")!;
    expect(fuelTonnes(Number.NaN, diesel)).toBe(0);
    expect(fuelTonnes(-5, diesel)).toBe(0);
  });
});
