import { describe, it, expect } from "vitest";
import {
  normalizeAmount,
  computeCo2e,
  selectFactor,
  calculate,
  calculateScope2DualReporting,
  GWP_AR6,
  type EmissionFactor,
} from "../ghg-protocol-engine";

// Sample DEFRA 2025 factors
const DEFRA_FACTORS: EmissionFactor[] = [
  {
    id: "DEFRA_2025_NG",
    externalId: "UK_NATURAL_GAS_DIRECT",
    scope: 1,
    category: "stationary_fuel",
    activityType: "natural_gas",
    inputUnit: "m3",
    co2: 1.89,
    ch4: 0.0001,
    n2o: 0.00005,
    source: "DEFRA_2025",
    country: "GB",
    effectiveStartDate: new Date("2025-01-01"),
  },
  {
    id: "DEFRA_2025_ELEC_LB",
    externalId: "UK_ELECTRICITY_LOCATION",
    scope: 2,
    category: "electricity_location_based",
    inputUnit: "kWh",
    co2e: 0.233,
    source: "DEFRA_2025",
    country: "GB",
    effectiveStartDate: new Date("2025-01-01"),
  },
  {
    id: "DEFRA_2025_ELEC_MB",
    externalId: "UK_ELECTRICITY_MARKET",
    scope: 2,
    category: "electricity_market_based",
    activityType: "market_based",
    inputUnit: "kWh",
    co2e: 0.05,
    source: "DEFRA_2025",
    country: "GB",
    effectiveStartDate: new Date("2025-01-01"),
  },
  {
    id: "DEFRA_2025_DIESEL",
    externalId: "UK_DIESEL_MOBILE",
    scope: 1,
    category: "mobile_fuel",
    activityType: "diesel",
    inputUnit: "litre",
    co2: 2.68,
    ch4: 0.00005,
    n2o: 0.0002,
    source: "DEFRA_2025",
    country: "GB",
    effectiveStartDate: new Date("2025-01-01"),
  },
];

describe("normalizeAmount — unit conversion", () => {
  it("converts tonnes to kg", () => {
    const { normalized, unit } = normalizeAmount(1, "tonne");
    expect(normalized).toBe(1000);
    expect(unit).toBe("tonne");
  });

  it("converts miles to km", () => {
    const { normalized } = normalizeAmount(1, "mile");
    expect(normalized).toBeCloseTo(1.60934, 4);
  });

  it("converts liters of diesel to kg", () => {
    const { normalized, unit } = normalizeAmount(100, "litre", "diesel_litre");
    expect(normalized).toBeCloseTo(83.2, 1); // 100L × 0.832 kg/L
    expect(unit).toBe("kg");
  });

  it("converts m³ of natural gas to kg", () => {
    const { normalized, unit } = normalizeAmount(100, "m3", "natural_gas_m3");
    expect(normalized).toBeCloseTo(72.9, 1); // 100 m³ × 0.729 kg/m³
    expect(unit).toBe("kg");
  });
});

describe("computeCo2e — gas-specific factors", () => {
  it("computes CO2e with CH4 and N2O using AR6 GWP", () => {
    const factor: EmissionFactor = DEFRA_FACTORS[0]; // Natural gas
    const result = computeCo2e(100, factor);

    expect(result.totalCo2e).toBeCloseTo(100 * 1.89 + 100 * 0.0001 * 27.9 + 100 * 0.00005 * 273, 4);
    expect(result.co2).toBeCloseTo(189, 1);
    expect(result.ch4).toBeCloseTo(0.01, 4);
    expect(result.n2o).toBeCloseTo(0.005, 4);
    expect(result.ch4Co2e).toBeCloseTo(0.279, 3);
    expect(result.n2oCo2e).toBeCloseTo(1.365, 3);
    expect(result.formula).toContain("GWP");
  });
});

describe("computeCo2e — scalar factors", () => {
  it("computes CO2e from scalar factor", () => {
    const factor: EmissionFactor = DEFRA_FACTORS[1]; // Electricity location-based
    const result = computeCo2e(1000, factor);

    expect(result.totalCo2e).toBeCloseTo(233);
    expect(result.co2).toBeUndefined();
    expect(result.ch4).toBeUndefined();
  });
});

describe("selectFactor — deterministic matching", () => {
  it("selects exact match by activity type", () => {
    const selection = selectFactor("mobile_fuel", "diesel", "GB", DEFRA_FACTORS, new Date());
    expect(selection?.factor.id).toBe("DEFRA_2025_DIESEL");
    expect(selection?.reason).toContain("activity type match");
  });

  it("prefers geography match", () => {
    const selection = selectFactor("stationary_fuel", "natural_gas", "GB", DEFRA_FACTORS, new Date());
    expect(selection?.factor.id).toBe("DEFRA_2025_NG");
    expect(selection?.reason).toContain("country match");
  });

  it("returns factor when in valid date range", () => {
    // Factor is valid on the specified date
    const selection = selectFactor("stationary_fuel", "natural_gas", "GB", DEFRA_FACTORS, new Date());
    expect(selection).toBeDefined(); // Current factors are valid today
    expect(selection?.factor.id).toBe("DEFRA_2025_NG");
  });

  it("is deterministic (sorts by ID for ties)", () => {
    const selection1 = selectFactor("stationary_fuel", "natural_gas", "GB", DEFRA_FACTORS, new Date());
    const selection2 = selectFactor("stationary_fuel", "natural_gas", "GB", DEFRA_FACTORS, new Date());
    expect(selection1?.factor.id).toBe(selection2?.factor.id);
  });
});

describe("calculateScope2DualReporting — location vs market", () => {
  it("returns both location-based and market-based emissions", () => {
    const locationFactor = DEFRA_FACTORS[1];
    const marketFactor = DEFRA_FACTORS[2];

    const result = calculateScope2DualReporting(1000, locationFactor, marketFactor);

    expect(result.locationBased.totalCo2e).toBeCloseTo(233);
    expect(result.marketBased?.totalCo2e).toBeCloseTo(50);
    expect(result.locationBased.warnings[0]).toContain("location-based");
    expect(result.marketBased?.warnings[0]).toContain("market-based");
  });

  it("handles missing market-based factor", () => {
    const locationFactor = DEFRA_FACTORS[1];

    const result = calculateScope2DualReporting(1000, locationFactor);

    expect(result.locationBased).toBeDefined();
    expect(result.marketBased).toBeUndefined();
  });
});

describe("calculate — end-to-end", () => {
  it("calculates electricity emissions (Scope 2)", () => {
    const result = calculate(
      {
        amount: 1000,
        unit: "kWh",
        category: "electricity_location_based",
        country: "GB",
        date: new Date(),
      },
      DEFRA_FACTORS,
    );

    expect(result?.totalCo2e).toBeCloseTo(233);
    expect(result?.factorId).toBe("DEFRA_2025_ELEC_LB");
  });

  it("calculates natural gas with fuel conversion", () => {
    const result = calculate(
      {
        amount: 100,
        unit: "m3",
        category: "stationary_fuel",
        activityType: "natural_gas",
        country: "GB",
        date: new Date(),
        fuelType: "natural_gas_m3",
      },
      DEFRA_FACTORS,
    );

    // 100 m³ × 0.729 kg/m³ = 72.9 kg
    // 72.9 kg × factor
    const kgNaturalGas = 100 * 0.729;
    const expectedCo2e =
      kgNaturalGas * 1.89 + kgNaturalGas * 0.0001 * 27.9 + kgNaturalGas * 0.00005 * 273;
    expect(result?.totalCo2e).toBeCloseTo(expectedCo2e, 0);
  });

  it("returns null when no factors found", () => {
    const result = calculate(
      {
        amount: 100,
        unit: "kWh",
        category: "end_of_life", // Not in DEFRA_FACTORS
        date: new Date(),
      },
      DEFRA_FACTORS,
    );

    expect(result?.factorId).toBe("NOT_FOUND");
    expect(result?.warnings[0]).toContain("No factors found");
  });

  it("includes audit trail in formula", () => {
    const result = calculate(
      {
        amount: 1000,
        unit: "kWh",
        category: "electricity_location_based",
        country: "GB",
        date: new Date(),
      },
      DEFRA_FACTORS,
    );

    expect(result?.formula).toContain("1000"); // Amount
    expect(result?.formula).toContain("0.233"); // Factor
    expect(result?.formula).toContain("233"); // Result
  });
});

describe("GWP Constants — AR6 alignment", () => {
  it("uses correct AR6 GWP values", () => {
    expect(GWP_AR6.CH4).toBe(27.9);
    expect(GWP_AR6.N2O).toBe(273);
    expect(GWP_AR6.SF6).toBe(25200);
  });
});
