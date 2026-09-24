// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { EmissionFactor } from "@prisma/client";

vi.mock("@/lib/db", () => ({ prisma: {} }));
import { selectFactor, type FactorCache } from "../factor-selector";
import { industryMissingWarning, isUnverifiedFactor, nafDivision, naicsCode, pickIndustry, ukSicDigits } from "../industry-code";

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
    expect(pickIndustry(c, "236220")).toEqual({ kind: "not_applicable", candidates: c });
  });

  it("recognises factors marked Unverified", () => {
    expect(isUnverifiedFactor({ usageNotes: "EEIO average. Unverified: no source." })).toBe(true);
    expect(isUnverifiedFactor({ usageNotes: "DEFRA 2026." })).toBe(false);
  });

  it("reads a NAF / UK SIC division, but not from a NAICS code", () => {
    expect(["79", "79.11", "79.11Z", "7911", "79110", "N79", "NAF-N79", "SIC 79110"].map(nafDivision)).toEqual(Array(8).fill("79"));
    expect(nafDivision("236220")).toBeNull();
    expect(nafDivision("hello")).toBeNull();
  });

  it("prices EUR spend by NAF division (ADEME) and never by an arbitrary division", async () => {
    const eur = { ...query, recordUnit: "EUR", geographyCountry: "FR" };
    const cache: FactorCache = new Map([["lib:cat", [f("n41", "naf_41", { inputUnit: "EUR" }), f("n79", "naf_79", { inputUnit: "EUR" })]]]);
    const s = await selectFactor({ ...eur, industryCode: "79.11Z" }, cache);
    expect(s?.factor.id).toBe("n79");
    expect(s?.selectionReason).toBe("NAF 79 matched");
    expect(await selectFactor(eur, cache)).toBeNull();
    expect(await selectFactor({ ...eur, industryCode: "99" }, cache)).toBeNull();
  });

  it("reads UK SIC 2007 codes in the usual spellings", () => {
    expect(["41.20", "41201", "SIC 41.20", "F41.20", "UK SIC 2007 41201"].map(ukSicDigits)).toEqual(["4120", "41201", "4120", "4120", "41201"]);
    expect(ukSicDigits("01.11")).toBe("0111");
    expect(ukSicDigits("46")).toBe("46");
    expect(ukSicDigits("236220")).toBeNull();
  });

  it("prices GBP spend by the UK SIC group with the longest matching prefix", async () => {
    const gb = { geographyCountry: "GB", inputUnit: "GBP" };
    const cache: FactorCache = new Map([["lib:cat", [
      f("s20a", "uksic_20A", gb), f("s203", "uksic_20.3", gb), f("s41", "uksic_41.2", gb), f("s43", "uksic_42.99", gb),
      f("s101", "uksic_10.1", gb), f("s102", "uksic_10.2-3", gb), f("generic", "purchased_goods_spend", gb),
    ]]]);
    const q = { ...query, geographyCountry: "GB", recordUnit: "GBP" };
    expect((await selectFactor({ ...q, industryCode: "20.13" }, cache))?.factor.id).toBe("s20a");
    expect((await selectFactor({ ...q, industryCode: "20301" }, cache))?.factor.id).toBe("s203");
    expect((await selectFactor({ ...q, industryCode: "41201" }, cache))?.selectionReason).toBe("UK SIC 41.2 matched");
    expect((await selectFactor({ ...q, industryCode: "43.21" }, cache))?.factor.id).toBe("s43");
    expect((await selectFactor({ ...q, industryCode: "10.39" }, cache))?.factor.id).toBe("s102");
  });

  it("never guesses a group from a division several groups share, and says so", async () => {
    const cache: FactorCache = new Map([["lib:cat", [f("s101", "uksic_10.1", { inputUnit: "GBP" }), f("s102", "uksic_10.2-3", { inputUnit: "GBP" }), f("generic", "purchased_goods_spend", { inputUnit: "GBP" })]]]);
    const s = await selectFactor({ ...query, recordUnit: "GBP", industryCode: "10" }, cache);
    expect(s?.factor.id).toBe("generic");
    expect(s?.warnings?.join(" ")).toContain("No UK spend multiplier covers SIC 10");
    expect(industryMissingWarning("UK SIC", null)).toMatch(/UK SIC 2007 code/);
  });
});
