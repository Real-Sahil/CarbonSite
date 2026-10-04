import { describe, expect, it } from "vitest";
import { selectionCaveats } from "../selection-caveats";

const car = { externalId: "epa-2025-hub-commute-passenger-car-km", usageNotes: "Passenger Car (car, average)." };
const bev = { externalId: "defra-2026-commute-car-bev-km", activityType: "employee_commuting_bev", usageNotes: "Average BEV" };

describe("selection caveats", () => {
  it("warns when an electric commute is priced with an average car", () => {
    expect(selectionCaveats({ categoryCode: "s3-commuting", matchHint: "BEV", factor: car })[0]).toMatch(/no battery-electric/);
    expect(selectionCaveats({ categoryCode: "s3-commuting", matchHint: "electric car", factor: car })).toHaveLength(1);
  });
  it("stays quiet when the factor is electric or the record is not", () => {
    expect(selectionCaveats({ categoryCode: "s3-commuting", matchHint: "BEV", factor: bev })).toEqual([]);
    expect(selectionCaveats({ categoryCode: "s3-commuting", matchHint: "Car", factor: car })).toEqual([]);
    expect(selectionCaveats({ categoryCode: "s3-business-travel", matchHint: "BEV", factor: car })).toEqual([]);
  });
  it("warns on a fugitive record that names no refrigerant, not on one that does", () => {
    const hfc = { externalId: "epa-2025-hub-refrigerant-hfc-125-kg" };
    expect(selectionCaveats({ categoryCode: "s1-fugitive", matchHint: "", factor: hfc })[0]).toContain("hfc-125");
    expect(selectionCaveats({ categoryCode: "s1-fugitive", matchHint: "R-410A", refrigerantType: "R-410A", factor: hfc })).toEqual([]);
    expect(selectionCaveats({ categoryCode: "s1-fugitive", matchHint: "  ", refrigerantType: "  ", factor: hfc })).toHaveLength(1);
  });
});
