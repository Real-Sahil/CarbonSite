import { describe, it, expect } from "vitest";
import { computeCo2e as computeCo2eCurrentEngine } from "../engine";
import { computeCo2e as computeCo2eNewEngine } from "../ghg-protocol-engine";
import type { EmissionFactor } from "../ghg-protocol-engine";

// Test fixtures: comprehensive emissions scenarios
const testScenarios = [
  // Scope 1: Natural gas combustion
  {
    name: "Natural gas: 100 m³ at STP",
    amount: 100,
    unit: "m3",
    currentEngineFactor: { co2: 1.89, ch4: 0.0001, n2o: 0.00005 },
    newEngineFactor: {
      id: "DEFRA_2025_NG",
      externalId: "UK_NATURAL_GAS_DIRECT",
      scope: 1,
      category: "stationary_fuel",
      inputUnit: "m3",
      co2: 1.89,
      ch4: 0.0001,
      n2o: 0.00005,
      source: "DEFRA_2025" as const,
      effectiveStartDate: new Date("2025-01-01"),
    } as EmissionFactor,
    expectedRange: { min: 180, max: 200 }, // ~189 + minimal CH4/N2O
  },

  // Scope 2: Electricity location-based
  {
    name: "Electricity (location-based): 1000 kWh UK grid",
    amount: 1000,
    unit: "kWh",
    currentEngineFactor: { co2e: 0.233 },
    newEngineFactor: {
      id: "DEFRA_2025_ELEC_LB",
      externalId: "UK_ELECTRICITY_LOCATION",
      scope: 2,
      category: "electricity_location_based",
      inputUnit: "kWh",
      co2e: 0.233,
      source: "DEFRA_2025" as const,
      effectiveStartDate: new Date("2025-01-01"),
    } as EmissionFactor,
    expectedRange: { min: 230, max: 235 }, // 1000 × 0.233
  },

  // Scope 2: Electricity market-based
  {
    name: "Electricity (market-based): 1000 kWh green contract",
    amount: 1000,
    unit: "kWh",
    currentEngineFactor: { co2e: 0.05 },
    newEngineFactor: {
      id: "DEFRA_2025_ELEC_MB",
      externalId: "UK_ELECTRICITY_MARKET",
      scope: 2,
      category: "electricity_market_based",
      inputUnit: "kWh",
      co2e: 0.05,
      source: "DEFRA_2025" as const,
      effectiveStartDate: new Date("2025-01-01"),
    } as EmissionFactor,
    expectedRange: { min: 49, max: 51 }, // 1000 × 0.05
  },

  // Scope 1: Diesel combustion
  {
    name: "Diesel: 100 litres vehicle fuel",
    amount: 100,
    unit: "litre",
    currentEngineFactor: { co2: 2.68, ch4: 0.00005, n2o: 0.0002 },
    newEngineFactor: {
      id: "DEFRA_2025_DIESEL",
      externalId: "UK_DIESEL_MOBILE",
      scope: 1,
      category: "mobile_fuel",
      activityType: "diesel",
      inputUnit: "litre",
      co2: 2.68,
      ch4: 0.00005,
      n2o: 0.0002,
      source: "DEFRA_2025" as const,
      effectiveStartDate: new Date("2025-01-01"),
    } as EmissionFactor,
    expectedRange: { min: 265, max: 275 }, // ~268 + CH4/N2O
  },

  // Scope 3: Business travel (air)
  {
    name: "Air travel: 10,000 km short-haul",
    amount: 10000,
    unit: "km",
    currentEngineFactor: { co2: 0.255, ch4: 0.00001, n2o: 0.00007 },
    newEngineFactor: {
      id: "DEFRA_2025_AIR_SHORT",
      externalId: "UK_DEFRA_2025_AIR_SHORT",
      scope: 3,
      category: "business_travel",
      activityType: "air_short_haul",
      inputUnit: "km",
      co2: 0.255,
      ch4: 0.00001,
      n2o: 0.00007,
      source: "DEFRA_2025" as const,
      effectiveStartDate: new Date("2025-01-01"),
    } as EmissionFactor,
    expectedRange: { min: 2730, max: 2760 }, // CO2: 2550 + CH4: 2.79 + N2O: 191.1 = 2743.89 kg CO2e
  },
];

describe("GHG Protocol Engine Integration — Current vs. Embedded", () => {
  let comparisonResults: Array<{
    scenario: string;
    currentResult: number;
    newResult: number;
    deviation: number;
    percentDeviation: number;
    withinTolerance: boolean;
  }> = [];

  testScenarios.forEach((scenario) => {
    it(`calculates ${scenario.name}`, () => {
      // Run current engine
      const currentResult = computeCo2eCurrentEngine(
        scenario.amount,
        scenario.unit,
        scenario.currentEngineFactor,
        scenario.unit,
      );

      // Run new embedded engine
      const newResult = computeCo2eNewEngine(scenario.amount, scenario.newEngineFactor);

      // Validate both within expected range
      expect(currentResult.totalCo2e).toBeGreaterThanOrEqual(scenario.expectedRange.min);
      expect(currentResult.totalCo2e).toBeLessThanOrEqual(scenario.expectedRange.max);
      expect(newResult.totalCo2e).toBeGreaterThanOrEqual(scenario.expectedRange.min);
      expect(newResult.totalCo2e).toBeLessThanOrEqual(scenario.expectedRange.max);

      // Calculate deviance
      const absDiff = Math.abs(newResult.totalCo2e - currentResult.totalCo2e);
      const pctDeviation = (absDiff / currentResult.totalCo2e) * 100;
      const withinTolerance = pctDeviation < 1.0;

      // Record for aggregate metrics
      comparisonResults.push({
        scenario: scenario.name,
        currentResult: currentResult.totalCo2e,
        newResult: newResult.totalCo2e,
        deviation: absDiff,
        percentDeviation: pctDeviation,
        withinTolerance,
      });

      // Assert <1% deviation (MVP validation threshold)
      expect(pctDeviation).toBeLessThan(1.0);

      // Audit trail validation
      expect(currentResult.formula).toBeTruthy();
      expect(newResult.formula).toBeTruthy();
    });
  });

  it("generates aggregate validation metrics", () => {
    const totalTests = comparisonResults.length;
    const passedTests = comparisonResults.filter((r) => r.withinTolerance).length;
    const avgDeviation =
      comparisonResults.reduce((sum, r) => sum + r.percentDeviation, 0) / totalTests;
    const maxDeviation = Math.max(...comparisonResults.map((r) => r.percentDeviation));

    console.log("\n📊 Integration Test Report");
    console.log("==========================");
    console.log(`Total Scenarios: ${totalTests}`);
    console.log(`Passed (<1% deviation): ${passedTests}/${totalTests}`);
    console.log(`Tolerance Rate: ${((passedTests / totalTests) * 100).toFixed(2)}%`);
    console.log(`Average Deviation: ${avgDeviation.toFixed(4)}%`);
    console.log(`Max Deviation: ${maxDeviation.toFixed(4)}%`);
    console.log("");

    comparisonResults.forEach((r) => {
      const status = r.withinTolerance ? "✓" : "✗";
      console.log(`${status} ${r.scenario}`);
      console.log(
        `  Current: ${r.currentResult.toFixed(2)} kg CO2e | New: ${r.newResult.toFixed(2)} kg CO2e`,
      );
      console.log(`  Deviation: ${r.percentDeviation.toFixed(4)}%\n`);
    });

    // Phase 1c Go-Decision Criteria
    const goDecision = {
      avgDeviationOk: avgDeviation < 1.0,
      maxDeviationOk: maxDeviation < 5.0, // Max single scenario deviation acceptable
      toleranceRateOk: (passedTests / totalTests) * 100 >= 95,
    };

    console.log("🎯 Go/No-Go Criteria");
    console.log("====================");
    console.log(`Average deviation <1%: ${goDecision.avgDeviationOk ? "✓ GO" : "✗ NO-GO"}`);
    console.log(
      `Max scenario deviation <5%: ${goDecision.maxDeviationOk ? "✓ GO" : "✗ NO-GO"}`,
    );
    console.log(
      `Tolerance rate ≥95%: ${goDecision.toleranceRateOk ? "✓ GO" : "✗ NO-GO"}`,
    );

    const allGo = goDecision.avgDeviationOk && goDecision.maxDeviationOk && goDecision.toleranceRateOk;
    console.log(`\n${allGo ? "✅ PHASE 1c PASSED" : "❌ PHASE 1c FAILED"}`);

    // Ensure pass condition
    expect(passedTests).toBe(totalTests);
  });
});
