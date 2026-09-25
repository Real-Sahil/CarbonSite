// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { EmissionFactor } from "@prisma/client";

vi.mock("@/lib/db", () => ({ prisma: {} }));
import { selectFactor, type FactorCache } from "../factor-selector";

// DEFRA 2026.1's commuting factors as loaded (ids, types and notes).
const f = (externalId: string, activityType: string, usageNotes: string) =>
  ({
    id: externalId, externalId, factorLibraryId: "lib", emissionCategoryId: "cat", activityType,
    geographyCountry: null, geographyRegion: null, effectiveStartDate: null, effectiveEndDate: null,
    inputUnit: "km", usageNotes,
  }) as unknown as EmissionFactor;

const commuting = [
  f("defra-2025-commute-cycling-km", "employee_commuting_cycling", "Carried forward from DEFRA 2025.1 (no DESNZ 2026 equivalent). Cycling / walking - zero operational emissions."),
  f("defra-2026-commute-bus-pkm", "employee_commuting_bus", "Average local bus, per passenger.km."),
  f("defra-2026-commute-car-avg-km", "employee_commuting", "Average car, unknown fuel, per vehicle.km."),
  f("defra-2026-commute-car-bev-km", "employee_commuting_bev", "Average BEV, UK grid charging incl. T&D, per vehicle.km."),
  f("defra-2026-commute-motorbike-km", "employee_commuting_motorbike", "Motorbike, average, per vehicle.km."),
  f("defra-2026-commute-rail-pkm", "employee_commuting_rail", "National rail, per passenger.km."),
];
const cache: FactorCache = new Map([["lib:cat", commuting]]);
const pick = async (hint: string) =>
  (await selectFactor({ emissionCategoryId: "cat", factorLibraryId: "lib", activityDate: new Date("2026-05-31"), recordUnit: "km", activityType: "employee_commuting", matchHint: hint }, cache))?.factor.externalId;

describe("transport detail hints", () => {
  it("never prices a car commute with the cycling factor", async () => {
    // "car" is also inside "Carried forward"; the category activity type decides.
    expect(await pick("car")).toBe("defra-2026-commute-car-avg-km");
  });

  it("picks each commuting mode's own factor", async () => {
    expect(await pick("BEV")).toBe("defra-2026-commute-car-bev-km");
    expect(await pick("Bus")).toBe("defra-2026-commute-bus-pkm");
    expect(await pick("Rail")).toBe("defra-2026-commute-rail-pkm");
    expect(await pick("Motorbike")).toBe("defra-2026-commute-motorbike-km");
    expect(await pick("Cycling or walking")).toBe("defra-2025-commute-cycling-km");
  });
});
