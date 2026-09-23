// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { EmissionFactor } from "@prisma/client";

vi.mock("@/lib/db", () => ({ prisma: {} }));
import { selectFactor, type FactorCache } from "../factor-selector";
import { isUnverifiedFactor, naicsCode, pickNaics } from "../industry-code";

const f = (id: string, activityType: string | null, over: Partial<EmissionFactor> = {}) =>
  ({
    id, externalId: id, factorLibraryId: "lib", emissionCategoryId: "cat", activityType,
    geographyCountry: "US", geographyRegion: null, effectiveStartDate: null, effectiveEndDate: null,
    inputUnit: "USD", usageNotes: null, ...over,
  }) as unknown as EmissionFactor;

const query = { emissionCategoryId: "cat", factorLibraryId: "lib", activityDate: new Date("2025-06-01"), recordUnit: "USD", geographyCountry: "US" };

describe("industry codes", () => {
  it("reads a 6-digit NAICS code in the usual spellings", () => {
    expect(["236220", "NAICS 236220", "naics_236220", " naics-236220 "].map(naicsCode)).toEqual(Array(4).fill("236220"));
    expect(naicsCode("2362")).toBeNull();
    expect(naicsCode("41.10")).toBeNull();
    expect(naicsCode(null)).toBeNull();
  });

  it("selects the record's own NAICS factor", async () => {
    const cache: FactorCache = new Map([["lib:cat", [f("a", "naics_111110"), f("b", "naics_236220")]]]);
    const s = await selectFactor({ ...query, industryCode: "236220" }, cache);
    expect(s?.factor.id).toBe("b");
    expect(s?.selectionReason).toBe("NAICS 236220 matched");
  });

  it("never falls back to an arbitrary NAICS factor without a code", async () => {
    const cache: FactorCache = new Map([["lib:cat", [f("a", "naics_111110"), f("b", "naics_236220")]]]);
    expect(await selectFactor(query, cache)).toBeNull();
    expect(await selectFactor({ ...query, industryCode: "999999" }, cache)).toBeNull();
  });

  it("uses the category's other factors, with a hint, when there is no code", async () => {
    const cache: FactorCache = new Map([["lib:cat", [f("a", "naics_111110"), f("generic", "spend_based")]]]);
    const s = await selectFactor(query, cache);
    expect(s?.factor.id).toBe("generic");
    expect(s?.warnings?.[0]).toMatch(/Add the supplier's 6-digit NAICS code/);
  });

  it("leaves libraries without NAICS factors alone", () => {
    const c = [f("x", "purchased_goods_spend")];
    expect(pickNaics(c, "236220")).toEqual({ kind: "not_applicable", candidates: c });
  });

  it("recognises factors marked Unverified", () => {
    expect(isUnverifiedFactor({ usageNotes: "EEIO average. Unverified: no source." })).toBe(true);
    expect(isUnverifiedFactor({ usageNotes: "DEFRA 2026." })).toBe(false);
  });
});
