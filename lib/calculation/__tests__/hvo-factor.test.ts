// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ prisma: {} }));
import type { EmissionFactor } from "@prisma/client";
import { selectHvoFactor, type FactorCache } from "../factor-selector";

const f = (externalId: string, co2e: number, biogenicCo2: number | null, category: string): EmissionFactor =>
  ({
    id: externalId, factorLibraryId: "lib", externalId, scope: 1, emissionCategoryId: category, activityType: null,
    geographyCountry: "GB", geographyRegion: null, effectiveStartDate: null, effectiveEndDate: null, inputUnit: "litre",
    co2: null, ch4: null, n2o: null, co2e, biogenicCo2, uncertaintyRating: null, usageNotes: null, priceBaseYear: null,
  }) as unknown as EmissionFactor;

const cache: FactorCache = new Map([
  ["lib:mobile", [f("defra-2026-diesel-litre", 2.58354, 0.14, "mobile"), f("defra-2026-hvo-litre", 0.03558, 2.43, "mobile")]],
  ["lib:stationary", [f("defra-2026-diesel-stationary-litre", 2.66155, null, "stationary")]],
]);
const q = (category: string) => ({ emissionCategoryId: category, activityDate: new Date("2026-05-01"), factorLibraryId: "lib", recordUnit: "litre" });

describe("HVO factor selection", () => {
  it("uses the HVO factor for neat HVO, even in a generator", async () => {
    const s = await selectHvoFactor(q("stationary"), cache, 1);
    expect(s?.factor.externalId).toBe("defra-2026-hvo-litre");
    expect(Number(s?.factor.biogenicCo2)).toBe(2.43);
  });

  it("weights a blend with the category's own diesel factor", async () => {
    const mobile = await selectHvoFactor(q("mobile"), cache, 0.5);
    expect(Number(mobile?.factor.co2e)).toBeCloseTo(0.5 * 0.03558 + 0.5 * 2.58354, 6);
    expect(Number(mobile?.factor.biogenicCo2)).toBeCloseTo(0.5 * 2.43 + 0.5 * 0.14, 6);
    expect(mobile?.selectionReason).toContain("HVO blend 50%");
    const generator = await selectHvoFactor(q("stationary"), cache, 0.3);
    expect(Number(generator?.factor.co2e)).toBeCloseTo(0.3 * 0.03558 + 0.7 * 2.66155, 6);
  });

  it("returns nothing when the library has no HVO factor", async () => {
    expect(await selectHvoFactor({ ...q("mobile"), factorLibraryId: "other" }, cache, 1)).toBeNull();
  });
});
