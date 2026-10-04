// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildEcccFactors, placeOf } from "../eccc";
import { electricityFactors, fuelFactors } from "../seai";

describe("ECCC electricity", () => {
  const hdr = (ys: (number | string)[]) => ["", ...ys];
  const sheet = (title: string, vals: number[]) => [
    [null, title],
    hdr([2018, 2019, "2023", "2024a"]),
    ["Consumption Intensity (g CO2 eq / kWh)", ...vals],
  ];
  it("builds one factor per year with open ends and footnoted years", () => {
    const f = buildEcccFactors({ "Table A7-1": sheet("Electricity intensity for Canada", [130, 120, 110, 100]), "Table A7-6": sheet("Electricity intensity for Ontario", [40, 35, 70, 73.3]) });
    const on = f.filter((x) => x.activityType === "grid_ca_on");
    expect(on.map((x) => x.externalId)).toEqual(["eccc-nir2024-elec-on-2019", "eccc-nir2024-elec-on-2023", "eccc-nir2024-elec-on-2024"]);
    expect(on[0].effectiveStart).toBeNull();
    expect(on[2].co2e).toBe(0.0733);
    expect(on[2].effectiveEnd).toBeNull();
    expect(f.some((x) => x.activityType === "purchased_electricity_location" && x.region == null)).toBe(true);
  });
  it("refuses an unknown place", () => {
    expect(() => placeOf("Electricity intensity for Atlantis")).toThrow(/unknown place/);
  });
});

describe("SEAI", () => {
  it("loads yearly electricity with open first and last years, CO2 only", () => {
    const f = electricityFactors([[2014, 500, 480], [2015, 450, 430], [2024, 220, 210], [2025, 197.8, 190]]);
    expect(f.map((x) => x.externalId)).toEqual(["seai-2025-elec-consumption-2015", "seai-2025-elec-consumption-2024", "seai-2025-elec-consumption-2025"]);
    expect(f[0].effectiveStart).toBeNull();
    expect(f[2].effectiveEnd).toBeNull();
    expect(f[2].co2e).toBe(0.1978);
  });
  it("reads fuel rows by section, zero-nets sustainable biofuels, gas per kWh by basis", () => {
    const rows = [
      ["Liquid", "Energy content", "", "", "g CO2/kWh", "", "kg CO2/kg", "kg CO2/litre"],
      ["Diesel / gasoil", 11.9, 0, 0, 263.4, 0, 3.17, 2.6, "", "", "", ""],
      ["Biodiesel HVO", 11.9, 0, 0, "-", "-", "-", "-", "", "", "", ""],
      ["Gas", "Energy content", "", "", "g CO2/kWh", "", "kg CO2/m3"],
      ["Natural gas (GCV)", 10.5, 0, 0, 204.7, 0, 2.1, 0, "", "", "", ""],
    ];
    const f = fuelFactors(rows);
    const diesel = f.find((x) => x.externalId === "seai-2025-stat-diesel-gasoil-litre");
    expect(diesel?.co2).toBe(2.6);
    expect(diesel?.activityType).toBe("stationary_combustion");
    expect(f.find((x) => x.externalId.includes("gas") && x.unit === "kWh")?.co2).toBe(0.2047);
  });
});
