// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { EmissionFactor } from "@prisma/client";

const libs: Record<string, string> = { "Defra UK spend multipliers|2023": "uk", "EPA USEEIO|1.3": "useeio" };
const factors: Record<string, Partial<EmissionFactor>[]> = {
  uk: [
    { id: "uk41-2022", factorLibraryId: "uk", emissionCategoryId: "cat", activityType: "uksic_41.2", effectiveStartDate: null, effectiveEndDate: new Date("2022-12-31") },
    { id: "uk41-2023", factorLibraryId: "uk", emissionCategoryId: "cat", activityType: "uksic_41.2", effectiveStartDate: new Date("2023-01-01"), effectiveEndDate: null },
  ],
  useeio: [{ id: "n236220", factorLibraryId: "useeio", emissionCategoryId: "cat", activityType: "naics_236220" }],
};
vi.mock("@/lib/db", () => ({
  prisma: {
    factorLibrary: { findUnique: vi.fn(async ({ where }: { where: { name_version: { name: string; version: string } } }) => {
      const id = libs[`${where.name_version.name}|${where.name_version.version}`];
      return id ? { id } : null;
    }) },
    emissionFactor: { findMany: vi.fn(async ({ where }: { where: { factorLibraryId: string } }) => factors[where.factorLibraryId] ?? []) },
  },
}));
import { selectSpendSupplement } from "../spend-supplement";
import type { FactorCache } from "../factor-selector";

const q = (industryCode: string, date = "2023-06-01") => ({ emissionCategoryId: "cat", factorLibraryId: "defra", activityDate: new Date(date), industryCode });

describe("spend priced from the currency's spend library", () => {
  it("prices GBP spend with the UK multiplier for the spend's own year", async () => {
    const caches = new Map<string, FactorCache | null>();
    const s = await selectSpendSupplement("GBP", "defra", q("41.20"), caches);
    expect(s?.factor.id).toBe("uk41-2023");
    expect(s?.selectionReason).toBe("UK SIC 41.2 matched in Defra UK spend multipliers 2023 (spend library for GBP)");
    expect((await selectSpendSupplement("GBP", "defra", q("41.20", "2022-03-01"), caches))?.factor.id).toBe("uk41-2022");
  });

  it("uses USEEIO for USD and nothing for a currency without a spend library", async () => {
    const caches = new Map<string, FactorCache | null>();
    expect((await selectSpendSupplement("usd", "defra", q("236220"), caches))?.factor.id).toBe("n236220");
    expect(await selectSpendSupplement("CHF", "defra", q("236220"), caches)).toBeNull();
  });

  it("returns nothing for an unknown code, or when the run already uses that library", async () => {
    expect(await selectSpendSupplement("GBP", "defra", q("99.99"), new Map())).toBeNull();
    expect(await selectSpendSupplement("GBP", "uk", q("41.20"), new Map())).toBeNull();
  });
});
