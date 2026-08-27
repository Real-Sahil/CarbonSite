import { describe, it, expect } from "vitest";
import { GhgCalculatorClient } from "../ghg-calculator-client";
import { compareCalculations, aggregateComparisons } from "../comparison-engine";

// Integration tests for ghg-calculator PoC
// These tests run against a live ghg-calculator API service
// Uncomment @skip to enable when running against real service

const GHG_API_URL = process.env.GHG_CALCULATOR_API_URL;

describe.skipIf(!GHG_API_URL)(
  "ghg-calculator integration — against live API",
  () => {
    const client = new GhgCalculatorClient({
      apiUrl: GHG_API_URL!,
      timeout: 10000,
    });

    describe("library metadata", () => {
      it.skip("fetches library info (DEFRA 2025 + EPA GHG Hub)", async () => {
        const info = await client.getLibraryInfo();

        expect(info.version).toMatch(/DEFRA.*2025.*EPA.*2025/i);
        expect(info.factorCount).toBeGreaterThan(900); // Target: 967
        expect(info.sources).toContain("DEFRA 2025");
        expect(info.sources).toContain("EPA GHG Hub 2025");
      });
    });

    describe("Scope 1 calculations", () => {
      it.skip("calculates stationary fuel combustion (natural gas)", async () => {
        const result = await client.calculate({
          amount: 1000,
          unit: "m3", // cubic meters of natural gas
          scope: "scope1",
          category: "stationary_fuel",
          activityType: "natural_gas",
          geography: { country: "GB" },
          date: "2024-08-27",
        });

        expect(result.totalCo2e).toBeGreaterThan(0);
        expect(result.factorId).toBeDefined();
        expect(result.factorLibraryVersion).toContain("DEFRA");
        expect(result.gases.co2).toBeGreaterThan(0);
      });

      it.skip("calculates mobile combustion (diesel vehicle)", async () => {
        const result = await client.calculate({
          amount: 100,
          unit: "litre",
          scope: "scope1",
          category: "mobile_fuel",
          activityType: "diesel",
          geography: { country: "GB" },
          date: "2024-08-27",
        });

        expect(result.totalCo2e).toBeGreaterThan(0);
        expect(result.gases.co2).toBeGreaterThan(0);
      });

      it.skip("calculates fugitive emissions (refrigerant leaks)", async () => {
        const result = await client.calculate({
          amount: 5,
          unit: "kg",
          scope: "scope1",
          category: "fugitive",
          activityType: "hfc-134a",
          date: "2024-08-27",
        });

        expect(result.totalCo2e).toBeGreaterThan(0);
        // Refrigerants have high GWP, so CH4/N2O components may be present
      });
    });

    describe("Scope 2 calculations", () => {
      it.skip("calculates location-based electricity (UK grid)", async () => {
        const result = await client.calculate({
          amount: 1000,
          unit: "kWh",
          scope: "scope2",
          category: "electricity",
          activityType: "location_based",
          geography: { country: "GB" },
          date: "2024-08-27",
        });

        expect(result.totalCo2e).toBeGreaterThan(0);
        expect(result.factorId).toMatch(/location|grid/i);
      });

      it.skip("calculates market-based electricity (renewable contract)", async () => {
        const result = await client.calculate({
          amount: 1000,
          unit: "kWh",
          scope: "scope2",
          category: "electricity",
          activityType: "market_based",
          geography: { country: "GB", region: "London" },
          date: "2024-08-27",
        });

        expect(result.totalCo2e).toBeLessThan(100); // Renewables have lower factors
        expect(result.factorId).toMatch(/market|supplier/i);
      });

      it.skip("falls back to location-based when market unavailable", async () => {
        // Query for a geography/supplier with no market-based factor
        const result = await client.calculate({
          amount: 1000,
          unit: "kWh",
          scope: "scope2",
          category: "electricity",
          activityType: "market_based",
          geography: { country: "XX" }, // Non-existent country code
          date: "2024-08-27",
        });

        // Should fall back to location-based with warning
        expect(result.warnings?.length).toBeGreaterThan(0);
        expect(result.warnings?.[0]).toContain("location-based");
      });
    });

    describe("Scope 3 calculations", () => {
      it.skip("calculates purchased goods upstream (raw materials)", async () => {
        const result = await client.calculate({
          amount: 100,
          unit: "kg",
          scope: "scope3",
          category: "purchased_goods",
          activityType: "steel",
          date: "2024-08-27",
        });

        expect(result.totalCo2e).toBeGreaterThan(0);
      });

      it.skip("calculates upstream transport (supply chain)", async () => {
        const result = await client.calculate({
          amount: 1000,
          unit: "tonne_km",
          scope: "scope3",
          category: "upstream_transport",
          activityType: "truck_transport",
          date: "2024-08-27",
        });

        expect(result.totalCo2e).toBeGreaterThan(0);
      });

      it.skip("calculates business travel (air)", async () => {
        const result = await client.calculate({
          amount: 10000,
          unit: "km",
          scope: "scope3",
          category: "business_travel",
          activityType: "air_short_haul",
          geography: { country: "GB" },
          date: "2024-08-27",
        });

        expect(result.totalCo2e).toBeGreaterThan(0);
        expect(result.gases.co2).toBeGreaterThan(0);
      });

      it.skip("calculates commuting (employee)", async () => {
        const result = await client.calculate({
          amount: 5000,
          unit: "km",
          scope: "scope3",
          category: "commuting",
          activityType: "car_average",
          geography: { country: "GB" },
          date: "2024-08-27",
        });

        expect(result.totalCo2e).toBeGreaterThan(0);
      });
    });

    describe("factor search", () => {
      it.skip("searches factors by scope + category", async () => {
        const response = await client.getFactors({
          scope: "scope1",
          category: "stationary_fuel",
        });

        expect(response.factors.length).toBeGreaterThan(0);
        expect(response.totalCount).toBeGreaterThan(100);
        expect(response.factors[0].scope).toBe("scope1");
      });

      it.skip("filters by activity type", async () => {
        const response = await client.getFactors({
          scope: "scope1",
          category: "stationary_fuel",
          activityType: "natural_gas",
        });

        expect(response.factors.length).toBeGreaterThan(0);
        expect(response.factors[0].activityType).toContain("natural_gas");
      });

      it.skip("filters by geography", async () => {
        const response = await client.getFactors({
          scope: "scope2",
          category: "electricity",
          geography: { country: "GB" },
        });

        expect(response.factors.length).toBeGreaterThan(0);
        // Should include UK-specific factors
        const ukFactors = response.factors.filter(
          (f) => f.geography?.country === "GB"
        );
        expect(ukFactors.length).toBeGreaterThan(0);
      });

      it.skip("filters by effective date", async () => {
        const response = await client.getFactors({
          scope: "scope2",
          category: "electricity",
          date: "2024-08-27",
        });

        // All returned factors should be valid for the requested date
        const requestDate = new Date("2024-08-27").getTime();
        response.factors.forEach((f) => {
          if (f.effectiveStartDate) {
            expect(new Date(f.effectiveStartDate).getTime()).toBeLessThanOrEqual(
              requestDate,
            );
          }
          if (f.effectiveEndDate) {
            expect(new Date(f.effectiveEndDate).getTime()).toBeGreaterThanOrEqual(
              requestDate,
            );
          }
        });
      });
    });

    describe("Comparison tests — current engine vs ghg-calculator", () => {
      it.skip("compares Scope 2 electricity (location-based) results", async () => {
        const result = await compareCalculations(
          1000, // kWh
          "kWh",
          { co2e: 0.233 }, // CarbonSite current factor
          client,
        );

        expect(result.currentEngine.totalCo2e).toBeCloseTo(233);
        expect(result.ghgCalculator).toBeDefined();

        // ghg-calculator should produce similar result (within tolerance)
        if (result.deviance) {
          console.log(
            `Deviance: ${result.deviance.percentageDifference.toFixed(2)}%`,
          );
          expect(result.deviance.withinTolerance).toBe(true);
        }
      });

      it.skip("compares Scope 1 natural gas combustion", async () => {
        const result = await compareCalculations(
          1000, // m3
          "m3",
          { co2: 1.89 }, // DEFRA factor
          client,
        );

        expect(result.currentEngine.totalCo2e).toBeCloseTo(1890);
        expect(result.deviance).toBeDefined();

        if (result.deviance) {
          expect(result.deviance.withinTolerance).toBe(true);
        }
      });
    });

    describe("Performance benchmarks", () => {
      it.skip("measures calculation latency (p95 < 200ms)", async () => {
        const latencies: number[] = [];

        for (let i = 0; i < 10; i++) {
          const start = performance.now();
          await client.calculate({
            amount: 100,
            unit: "kWh",
            scope: "scope2",
            category: "electricity",
            date: "2024-08-27",
          });
          latencies.push(performance.now() - start);
        }

        latencies.sort((a, b) => a - b);
        const p95 = latencies[Math.floor(latencies.length * 0.95)];

        console.log(`Calculation latency (p95): ${p95.toFixed(1)}ms`);
        expect(p95).toBeLessThan(200);
      });

      it.skip("measures factor search latency (p95 < 100ms)", async () => {
        const latencies: number[] = [];

        for (let i = 0; i < 10; i++) {
          const start = performance.now();
          await client.getFactors({
            scope: "scope1",
            category: "stationary_fuel",
          });
          latencies.push(performance.now() - start);
        }

        latencies.sort((a, b) => a - b);
        const p95 = latencies[Math.floor(latencies.length * 0.95)];

        console.log(`Factor search latency (p95): ${p95.toFixed(1)}ms`);
        expect(p95).toBeLessThan(100);
      });
    });
  },
);
