// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { EmissionFactor } from "@prisma/client";

vi.mock("@/lib/db", () => ({ prisma: {} }));
import { selectFactor, type FactorCache } from "../factor-selector";
import { pickEgridSubregion, subregionInHint } from "../egrid-subregion";

const f = (externalId: string, activityType: string, co2e: number, geographyCountry = "US") =>
  ({
    id: externalId, externalId, factorLibraryId: "lib", emissionCategoryId: "cat", activityType, geographyCountry,
    geographyRegion: null, effectiveStartDate: null, effectiveEndDate: null, inputUnit: "kWh", co2e, usageNotes: "",
  }) as unknown as EmissionFactor;

const grid = [
  f("epa-2025-egrid2023-us-avg-kwh", "purchased_electricity_location", 0.35),
  f("epa-2025-egrid2023-camx-kwh", "egrid_camx", 0.195),
  f("epa-2025-egrid2023-nyup-kwh", "egrid_nyup", 0.109),
];
const cache: FactorCache = new Map([["lib:cat", grid]]);
const pick = async (hint?: string, egridSubregion?: string | null) =>
  (await selectFactor({ emissionCategoryId: "cat", factorLibraryId: "lib", activityDate: new Date("2025-06-01"), recordUnit: "kWh", activityType: "purchased_electricity_location", geographyCountry: "US", matchHint: hint, egridSubregion }, cache))?.factor.externalId;

describe("eGRID subregion choice", () => {
  it("reads a subregion code from text as a whole word", () => {
    expect(subregionInHint("eGRID camx")).toBe("CAMX");
    expect(subregionInHint("NYUP")).toBe("NYUP");
    expect(subregionInHint("campaign")).toBeNull();
    expect(subregionInHint(undefined)).toBeNull();
  });

  it("uses the US average unless a subregion is named", async () => {
    expect(await pick()).toBe("epa-2025-egrid2023-us-avg-kwh");
    expect(await pick("grid supply")).toBe("epa-2025-egrid2023-us-avg-kwh");
  });

  it("uses the named subregion, the record's text before the facility's", async () => {
    expect(await pick("eGRID CAMX")).toBe("epa-2025-egrid2023-camx-kwh");
    expect(await pick(undefined, "NYUP")).toBe("epa-2025-egrid2023-nyup-kwh");
    expect(await pick("CAMX", "NYUP")).toBe("epa-2025-egrid2023-camx-kwh");
  });

  it("ignores an unknown facility code and never hands out subregion rows by tie-break", async () => {
    expect(await pick(undefined, "ZZZZ")).toBe("epa-2025-egrid2023-us-avg-kwh");
    expect(pickEgridSubregion(grid, undefined, "ZZZZ")).toMatchObject({ kind: "rest" });
  });
});
