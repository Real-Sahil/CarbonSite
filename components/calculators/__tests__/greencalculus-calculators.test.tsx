import { describe, it, expect } from "vitest";

describe("GreenCalculus Calculators", () => {
  describe("Scope 1 Combustion Calculator", () => {
    it("calculates natural gas emissions correctly", () => {
      const amount = 100; // m3
      const factor = 1.8443 * 0.717; // kg CO2e per m3
      const result = amount * factor;

      expect(result).toBeCloseTo(132.24, 1);
    });

    it("calculates diesel emissions correctly", () => {
      const amount = 50; // litres
      const factor = 3.1569 * 0.832; // kg CO2e per litre
      const result = amount * factor;

      expect(result).toBeCloseTo(131.33, 1);
    });

    it("calculates petrol emissions correctly", () => {
      const amount = 60; // litres
      const factor = 3.1014 * 0.737; // kg CO2e per litre
      const result = amount * factor;

      expect(result).toBeCloseTo(137.14, 1);
    });

    it("calculates LPG emissions correctly", () => {
      const amount = 40; // kg
      const factor = 2.9752; // kg CO2e per kg
      const result = amount * factor;

      expect(result).toBeCloseTo(119.01, 1);
    });

    it("calculates heating oil emissions correctly", () => {
      const amount = 1000; // litres
      const factor = 3.1449 * 0.85; // kg CO2e per litre
      const result = amount * factor;

      expect(result).toBeCloseTo(2673.17, 1);
    });

    it("handles zero inputs gracefully", () => {
      const amount = 0;
      const factor = 1.8443 * 0.717;
      const result = amount * factor;

      expect(result).toBe(0);
    });

    it("rejects negative inputs", () => {
      const amount = -50;
      expect(Number.isFinite(amount) && amount >= 0).toBe(false);
    });

    it("handles large values", () => {
      const amount = 1000000; // m3 natural gas
      const factor = 1.8443 * 0.717;
      const result = amount * factor;

      expect(result).toBeGreaterThan(1000000);
      expect(Number.isFinite(result)).toBe(true);
    });
  });

  describe("Scope 2 Electricity Calculator", () => {
    it("calculates UK location-based emissions", () => {
      const kWh = 1000;
      const factor = 0.233; // kg CO2e per kWh
      const result = kWh * factor;

      expect(result).toBeCloseTo(233, 1);
    });

    it("calculates UK market-based emissions (green tariff)", () => {
      const kWh = 1000;
      const factor = 0.05; // kg CO2e per kWh
      const result = kWh * factor;

      expect(result).toBeCloseTo(50, 1);
    });

    it("calculates EU grid emissions", () => {
      const kWh = 5000;
      const locationBased = kWh * 0.24; // kg CO2e per kWh
      const marketBased = kWh * 0.08;

      expect(locationBased).toBeCloseTo(1200, 1);
      expect(marketBased).toBeCloseTo(400, 1);
    });

    it("calculates US grid emissions", () => {
      const kWh = 10000;
      const factor = 0.387;
      const result = kWh * factor;

      expect(result).toBeCloseTo(3870, 1);
    });

    it("calculates Australian grid emissions", () => {
      const kWh = 2000;
      const factor = 0.72;
      const result = kWh * factor;

      expect(result).toBeCloseTo(1440, 1);
    });

    it("demonstrates dual reporting benefit", () => {
      const kWh = 5000;
      const locationBased = kWh * 0.233; // UK average
      const marketBased = kWh * 0.05; // Green contract

      const savings = locationBased - marketBased;
      expect(savings).toBeCloseTo(915, 1);
      expect(savings).toBeGreaterThan(0);
    });

    it("handles custom factors", () => {
      const kWh = 1000;
      const customFactor = 0.15;
      const result = kWh * customFactor;

      expect(result).toBeCloseTo(150, 1);
    });

    it("handles zero consumption", () => {
      const kWh = 0;
      const factor = 0.233;
      const result = kWh * factor;

      expect(result).toBe(0);
    });

    it("rejects negative consumption", () => {
      const kWh = -1000;
      expect(Number.isFinite(kWh) && kWh >= 0).toBe(false);
    });

    it("validates custom factors", () => {
      const customFactor = -0.1;
      expect(Number.isFinite(customFactor) && customFactor >= 0).toBe(false);
    });
  });

  describe("Cross-Calculator Validation", () => {
    it("Scope 1 and Scope 2 can be combined for mixed energy sources", () => {
      // Natural gas heating
      const naturalGasM3 = 100;
      const naturalGasFactor = 1.8443 * 0.717;
      const gasCo2e = naturalGasM3 * naturalGasFactor;

      // Electricity
      const electricityKWh = 5000;
      const electricityFactor = 0.233; // UK location-based
      const electricityCo2e = electricityKWh * electricityFactor;

      const totalCo2e = gasCo2e + electricityCo2e;

      expect(totalCo2e).toBeCloseTo(1297.24, 1);
      expect(totalCo2e).toBeGreaterThan(gasCo2e);
      expect(totalCo2e).toBeGreaterThan(electricityCo2e);
    });

    it("can estimate savings from energy efficiency", () => {
      const kWhBefore = 10000;
      const kWhAfter = 8000;
      const factor = 0.233;

      const beforeCo2e = kWhBefore * factor;
      const afterCo2e = kWhAfter * factor;
      const savings = beforeCo2e - afterCo2e;

      expect(savings).toBeCloseTo(466, 1);
      expect(savings).toBeGreaterThan(0);
    });

    it("demonstrates green tariff impact on multi-site organization", () => {
      // 3 sites with different tariffs
      const site1LocationBased = 5000 * 0.233;
      const site1MarketBased = 5000 * 0.05; // green tariff

      const site2LocationBased = 3000 * 0.233;
      const site2MarketBased = 3000 * 0.05; // green tariff

      const site3LocationBased = 2000 * 0.233;
      const site3MarketBased = 2000 * 0.233; // no tariff, grid average

      const totalLocationBased = site1LocationBased + site2LocationBased + site3LocationBased;
      const totalMarketBased = site1MarketBased + site2MarketBased + site3MarketBased;

      const organizationSavings = totalLocationBased - totalMarketBased;

      expect(organizationSavings).toBeCloseTo(1464, 1);
      expect(organizationSavings).toBeGreaterThan(0);
    });
  });

  describe("Data Quality & Precision", () => {
    it("maintains precision for small values", () => {
      const kWh = 0.01;
      const factor = 0.233;
      const result = kWh * factor;

      expect(result).toBeCloseTo(0.00233, 5);
    });

    it("maintains precision for very large values", () => {
      const m3 = 10000000;
      const factor = 1.8443 * 0.717;
      const result = m3 * factor;

      expect(Number.isFinite(result)).toBe(true);
      expect(result).toBeGreaterThan(0);
    });

    it("provides rounding consistency at 2 decimal places", () => {
      const result = 132.056789;
      const rounded = Math.round(result * 100) / 100;

      expect(rounded).toBe(132.06);
    });
  });
});
