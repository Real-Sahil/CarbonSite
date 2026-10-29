import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SITE_WASTES, wasteById, wasteTonnes } from "@/lib/tools/site-waste";

type Row = { externalId: string; co2e: number; inputUnit: string };
const library = JSON.parse(readFileSync(join(process.cwd(), "prisma/data/defra-2026-factors.json"), "utf8")) as { factors: Row[] };

describe("site waste calculator factors", () => {
  it("matches the loaded DEFRA 2026 library, per tonne", () => {
    for (const waste of SITE_WASTES) {
      const row = library.factors.find((f) => f.externalId === waste.externalId);
      expect(row, waste.externalId).toBeDefined();
      expect(row!.inputUnit).toBe("tonne");
      expect(waste.kgCo2ePerTonne).toBe(row!.co2e);
    }
  });

  it("converts tonnes of waste to tonnes CO2e", () => {
    expect(wasteTonnes(10, wasteById("mixed-landfill")!)).toBeCloseTo(5.206, 3);
  });

  it("counts a missing or negative quantity as zero", () => {
    const w = wasteById("efw")!;
    expect(wasteTonnes(Number.NaN, w)).toBe(0);
    expect(wasteTonnes(-5, w)).toBe(0);
  });
});
