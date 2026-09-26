import { describe, expect, it } from "vitest";
import { hazardFromText, routeFromText, wasteRowsFromRecords } from "../from-records";

describe("wasteRowsFromRecords", () => {
  it("takes tonnes from t and kg records and skips other units", () => {
    const { rows, skipped } = wasteRowsFromRecords([
      { amount: 108, unit: "tonnes", sourceDescription: "Mixed C&D waste, EWC 17 09 04", fuelType: null, facilityId: "f1" },
      { amount: 500, unit: "kg", sourceDescription: "Plasterboard to recycling", fuelType: null, facilityId: null },
      { amount: 3, unit: "skips", sourceDescription: "General waste", fuelType: null, facilityId: null },
    ]);
    expect(skipped).toBe(1);
    expect(rows).toEqual([
      { tonnes: 108, route: null, hierarchy: null, hazardous: false, facilityId: "f1" },
      { tonnes: 0.5, route: "recycling_mixed", hierarchy: "recycle", hazardous: null, facilityId: null },
    ]);
  });

  it("reads the route only from what the record says", () => {
    expect(routeFromText("Muck away to landfill")).toBe("landfill_mixed");
    expect(routeFromText("Asbestos, hazardous landfill")).toBe("hazardous_landfill");
    expect(routeFromText("General waste to EfW")).toBe("incineration_efw");
    expect(routeFromText("Mixed C&D waste, EWC 17 09 04")).toBeNull();
  });

  it("marks asterisked EWC codes hazardous", () => {
    expect(hazardFromText("Contaminated soil EWC 17 05 03*")).toBe(true);
    expect(hazardFromText("Soil and stones EWC 17 05 04")).toBe(false);
    expect(hazardFromText("Soil and stones")).toBeNull();
  });
});
