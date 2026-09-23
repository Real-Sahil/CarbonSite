// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { Prisma, type OrganizationEmissionFactor } from "@prisma/client";

const db = vi.hoisted(() => ({ organizationEmissionFactor: { findMany: vi.fn() } }));
vi.mock("@/lib/db", () => ({ prisma: db }));

import { customFactorAsLibraryFactor, loadOrgCustomFactors, pickCustomFactor } from "../custom-factors";

let n = 0;
const factor = (over: Partial<OrganizationEmissionFactor> = {}): OrganizationEmissionFactor => ({
  id: `f${++n}`,
  organizationId: "org-a",
  scope: 3,
  emissionCategoryId: "cat-waste",
  activityType: null,
  geographyCountry: null,
  geographyRegion: null,
  effectiveStartDate: null,
  effectiveEndDate: null,
  inputUnit: "tonnes",
  co2: null,
  ch4: null,
  n2o: null,
  co2e: new Prisma.Decimal(10),
  uncertaintyRating: null,
  usageNotes: null,
  priceBaseYear: null,
  source: "uploaded_csv",
  version: 1,
  createdByUserId: "u",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...over,
});

const query = {
  organizationId: "org-a",
  emissionCategoryId: "cat-waste",
  activityType: "waste",
  geographyCountry: "GB",
  activityDate: new Date("2026-03-01"),
  recordUnit: "tonnes",
};

describe("organisation factor matching", () => {
  it("never uses another organisation's factor", () => {
    const other = factor({ organizationId: "org-b" });
    expect(pickCustomFactor([other], query)).toBeNull();
    expect(pickCustomFactor([other], { ...query, organizationId: "org-b" })?.factor.id).toBe(other.id);
  });

  it("loads only the calling organisation's factors", async () => {
    db.organizationEmissionFactor.findMany.mockResolvedValue([]);
    await loadOrgCustomFactors("org-a");
    expect(db.organizationEmissionFactor.findMany.mock.calls[0][0].where.organizationId).toBe("org-a");
  });

  it("needs the same category, a usable unit and dates covering the activity", () => {
    expect(pickCustomFactor([factor({ emissionCategoryId: "cat-other" })], query)).toBeNull();
    expect(pickCustomFactor([factor({ inputUnit: "kWh" })], query)).toBeNull();
    expect(pickCustomFactor([factor({ inputUnit: "kg" })], query)).not.toBeNull();
    expect(pickCustomFactor([factor({ effectiveEndDate: new Date("2025-12-31") })], query)).toBeNull();
    expect(pickCustomFactor([factor({ effectiveStartDate: new Date("2026-06-01") })], query)).toBeNull();
    expect(pickCustomFactor([factor({ co2e: null })], query)).toBeNull();
  });

  it("skips a factor for another country or activity", () => {
    expect(pickCustomFactor([factor({ geographyCountry: "FR" })], query)).toBeNull();
    expect(pickCustomFactor([factor({ activityType: "diesel" })], query)).toBeNull();
    expect(pickCustomFactor([factor({ activityType: "diesel" })], { ...query, matchHint: "Diesel" })).not.toBeNull();
  });

  it("prefers the most specific factor, then the latest version", () => {
    const general = factor({ version: 5 });
    const gb = factor({ geographyCountry: "GB" });
    expect(pickCustomFactor([general, gb], query)?.factor.id).toBe(gb.id);
    const v2 = factor({ version: 2 });
    const picked = pickCustomFactor([general, v2], query);
    expect(picked?.factor.id).toBe(general.id);
    expect(picked?.reason).toContain("organisation factor v5");
  });

  it("presents the factor to the engine without a library factor id of its own", () => {
    const f = factor({ co2e: new Prisma.Decimal(12.5) });
    const lib = customFactorAsLibraryFactor(f, "lib-1");
    expect(lib).toMatchObject({ factorLibraryId: "lib-1", externalId: null, priceBaseYear: null, inputUnit: "tonnes" });
    expect(Number(lib.co2e)).toBe(12.5);
    expect(customFactorAsLibraryFactor(factor({ priceBaseYear: 2021 }), "lib-1").priceBaseYear).toBe(2021);
  });
});
