import { describe, expect, it } from "vitest";
import { buildEpaHubFactors, buildEpaHubMigrationSql } from "../epa-hub";

// A slice of the Hub workbook in its real layout: the title is split over
// columns 1 and 2, values start in column 3.
const r = (...c: (string | number)[]) => ["", ...c];
const hub = [
  r("Table 1", "   Stationary Combustion"),
  r("", "Fuel Type", "Heat Content (HHV)"),
  r("", "", "mmBtu per short ton", "kg CO2 per mmBtu", "g CH4 per mmBtu", "g N2O per mmBtu", "kg CO2 per short ton", "g CH4 per short ton", "g N2O per short ton"),
  r("", "Coal and Coke"),
  r("", "Bituminous", 24.93, 93.28, 11, 1.6, 2325, 274, 40),
  r("", "Biomass Fuels - Solid"),
  r("", "Wood and Wood Residuals", 17.48, 93.8, 7.2, 3.6, 1640, 126, 63),
  r("", "", "mmBtu per scf", "kg CO2 per mmBtu", "g CH4 per mmBtu", "g N2O per mmBtu", "kg CO2 per scf", "g CH4 per scf", "g N2O per scf"),
  r("", "Natural Gas"),
  r("", "Natural Gas", 0.001026, 53.06, 1, 0.1, 0.05444, 0.00103, 0.0001),
  r("", "Other Fuels - Gaseous"),
  r("", "Propane Gas", 0.002516, 61.46, 3, 0.6, 0.15463, 0.007548, 0.00151),
  r("", "", "mmBtu per gallon", "kg CO2 per mmBtu", "g CH4 per mmBtu", "g N2O per mmBtu", "kg CO2 per gallon", "g CH4 per gallon", "g N2O per gallon"),
  r("", "Petroleum Products"),
  r("", "Distillate Fuel Oil No. 2", 0.138, 73.96, 3, 0.6, 10.21, 0.41, 0.08),
  r("", "Source:"),
  r("Table 2", "Mobile Combustion CO2"),
  r("", "Fuel Type", "kg CO2 per unit", "Unit"),
  r("", "Diesel Fuel", 10.21, "gallon"),
  r("", "Biodiesel (100%)", 9.45, "gallon"),
  r("", "Compressed Natural Gas (CNG)", 0.05444, "scf"),
  r("", "Source:"),
  r("Table 7", "Steam and Heat"),
  r("", "", "CO2", "CH4", "N2O"),
  r("", "Steam and Heat", 66.33, 1.25, 0.125),
  r("", "Notes:"),
  r("Table 8", "Scope 3 Category 4"),
  r("", "Vehicle Type", "CO2", "CH4", "N2O", "Units"),
  r("", "Medium- and Heavy-Duty Truck", 1.298, 0.0115, 0.0376, "vehicle-mile"),
  r("", "Medium- and Heavy-Duty TruckC", 0.186, 0.0016, 0.0054, "short ton-mile"),
  r("", "Source:"),
  r("Table 9", "Waste"),
  r("", "Material", "Recycled", "Landfilled", "Combusted", "Composted"),
  r("", "Mixed MSW", "NA", 0.58, 0.43, "NA"),
  r("", "Glass", 0.05, 0.02, 0.01, "NA"),
  r("", "Source:"),
  r("Table 10", "Travel"),
  r("", "Vehicle Type", "CO2", "CH4", "N2O", "Units"),
  r("", "Passenger Car A", 0.297, 0.0059, 0.0053, "vehicle-mile"),
  r("", "Bus", 0.066, 0.0046, 0.0019, "passenger-mile"),
  r("", "Source:"),
  r("Table 11", "GWP"),
  r("", "Name", "Formula", "GWP"),
  r("", "HFC-134a", "CH2FCF3", 1300),
  r("", "Methane", "CH4", 28),
  r("", "Source:"),
  r("Table 12", "Blends"),
  r("", "ASHRAE #", "GWP", "Composition"),
  r("", "R-410A", 1924, "50% HFC-32 , 50% HFC-125"),
  r("", "Source:"),
];
const sub = [
  [],
  ["YEAR", "SUBRGN", "SRNAME", "SRCO2RTA", "SRCH4RTA", "SRN2ORTA", "SRC2ERTA"],
  [2023, "CAMX", "WECC California", 428.464, 0.025, 0.003, 429.983],
  [2023, "PRMS", "Puerto Rico Miscellaneous", 1543.073, 0.077, 0.012, 1548.53],
];
const us = [[], ["YEAR", "USCO2RTA", "USCH4RTA", "USN2ORTA", "USC2ERTA"], [2023, 767.209, 0.057, 0.008, 770.884]];

const factors = buildEpaHubFactors({ hub, egridSubregions: sub, egridUs: us });
const by = (id: string) => factors.find((f) => f.externalId === id)!;

describe("EPA Hub 2025 and eGRID2023 factors", () => {
  it("reads each fuel block in its own unit and converts to canonical units", () => {
    const diesel = by("epa-2025-hub-stat-distillate-fuel-oil-no-2-litre");
    expect(diesel.unit).toBe("litre");
    expect(diesel.co2).toBeCloseTo(10.21 / 3.785411784, 6);
    expect(diesel.activityType).toBe("stationary_combustion"); // category default for litres
    expect(by("epa-2025-hub-stat-bituminous-kg").unit).toBe("kg");
    // Gas by volume is priced on energy: 61.46 kg CO2 per mmBtu is 0.2097 per kWh.
    const propane = by("epa-2025-hub-stat-propane-gas-kwh");
    expect(propane.unit).toBe("kWh");
    expect(propane.co2).toBeCloseTo(61.46 / 293.07107, 6);
  });

  it("leaves the factors the library already has, and CNG by volume, out", () => {
    expect(factors.find((f) => f.externalId.includes("natural-gas-kwh"))).toBeUndefined();
    expect(factors.find((f) => f.externalId.includes("mobile-diesel-fuel"))).toBeUndefined();
    expect(factors.find((f) => f.externalId.includes("compressed-natural-gas"))).toBeUndefined();
  });

  it("combines gases with AR5 GWPs and keeps biogenic CO2 out of CO2e", () => {
    const bit = by("epa-2025-hub-stat-bituminous-kg");
    expect(bit.co2e).toBeCloseTo(bit.co2! + bit.ch4! * 28 + bit.n2o! * 265, 6);
    const wood = by("epa-2025-hub-stat-wood-and-wood-residuals-kg");
    expect(wood.co2).toBeNull();
    expect(wood.biogenicCo2).toBeGreaterThan(1.7);
    expect(wood.co2e).toBeLessThan(0.1);
    expect(by("epa-2025-hub-mobile-biodiesel-100-litre").biogenicCo2).toBeCloseTo(9.45 / 3.785411784, 6);
  });

  it("converts miles and short tons and picks category defaults", () => {
    const truck = by("epa-2025-hub-up-medium-and-heavy-duty-truck-tonnekm");
    expect(truck.unit).toBe("tonne.km");
    expect(truck.co2).toBeCloseTo(0.186 / (0.90718474 * 1.609344), 6);
    expect(truck.activityType).toBe("upstream_transport");
    expect(by("epa-2025-hub-travel-passenger-car-km").activityType).toBe("business_travel");
    expect(by("epa-2025-hub-commute-passenger-car-km").activityType).toBe("employee_commuting");
    expect(by("epa-2025-hub-travel-bus-pkm").unit).toBe("pkm");
    expect(factors.some((f) => f.externalId.includes("commute-bus"))).toBe(true);
  });

  it("loads waste per kg, skips NA routes and makes only mixed MSW landfill the default", () => {
    expect(by("epa-2025-hub-waste-mixed-msw-landfilled-kg").co2e).toBeCloseTo((0.58 * 1000) / 907.18474, 6);
    expect(by("epa-2025-hub-waste-mixed-msw-landfilled-kg").activityType).toBe("waste_disposal");
    expect(by("epa-2025-hub-waste-mixed-msw-combusted-kg").activityType).toBe("waste_combusted_mixed-msw");
    expect(by("epa-2025-hub-waste-glass-landfilled-kg").activityType).toBe("waste_landfilled_glass");
    expect(factors.find((f) => f.externalId === "epa-2025-hub-waste-mixed-msw-recycled-kg")).toBeUndefined();
  });

  it("takes refrigerant GWPs for HFCs and blends only", () => {
    expect(by("epa-2025-hub-refrigerant-hfc-134a-kg").co2e).toBe(1300);
    expect(by("epa-2025-hub-refrigerant-hfc-134a-kg").notes).toContain("R-134a");
    expect(by("epa-2025-hub-refrigerant-r-410a-kg").co2e).toBe(1924);
    expect(factors.some((f) => f.externalId.includes("methane"))).toBe(false);
  });

  it("converts eGRID lb/MWh to kg/kWh, gating subregions by activity type", () => {
    expect(by("epa-2025-egrid2023-camx-kwh").co2e).toBeCloseTo((429.983 * 0.45359237) / 1000, 8);
    expect(by("epa-2025-egrid2023-camx-kwh").activityType).toBe("egrid_camx");
    expect(by("epa-2025-egrid2023-us-avg-kwh").activityType).toBe("purchased_electricity_location");
    // Puerto Rico's only subregion is its country default.
    expect(by("epa-2025-egrid2023-prms-kwh")).toMatchObject({ country: "PR", activityType: "purchased_electricity_location" });
    // The new national row sorts before the older, stale one so it wins an id tie-break.
    expect("epa-2025-egrid2023-us-avg-kwh" < "epa-2025-elec-us-lb-kwh").toBe(true);
  });

  it("writes an additive migration", () => {
    const sql = buildEpaHubMigrationSql(factors, ["hub.xlsx"]);
    expect(sql).toContain('ON CONFLICT ("factor_library_id", "external_id") DO NOTHING');
    expect(sql).not.toMatch(/DROP|UPDATE |DELETE/);
    expect(new Set(factors.map((f) => f.externalId)).size).toBe(factors.length);
  });
});
