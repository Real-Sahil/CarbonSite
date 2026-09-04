import { describe, it, expect, vi } from "vitest";
import { GhgCalculatorClient, type GhgCalculatorConfig } from "../ghg-calculator-client";
import { compareCalculations, aggregateComparisons } from "../comparison-engine";
import type { CalculateResponse } from "../ghg-calculator-client";

// Mock HTTP responses for testing
const mockCalculateResponse: CalculateResponse = {
  totalCo2e: 23.3,
  gases: {
    co2: 23.3,
    ch4: null,
    n2o: null,
    co2e: null,
  },
  factorId: "DEFRA_2025_ELECTRICITY_UK",
  factorLibraryVersion: "DEFRA_2025.1",
  formula: "100 kWh × 0.233 kg CO2e/kWh = 23.3 kg CO2e",
};

describe("GhgCalculatorClient — initialization", () => {
  it("creates client with valid config", () => {
    const client = new GhgCalculatorClient({
      apiUrl: "http://localhost:9000",
    });
    expect(client.isEnabled()).toBe(true);
  });

  it("respects enabled flag", () => {
    const client = new GhgCalculatorClient({
      apiUrl: "http://localhost:9000",
      enabled: false,
    });
    expect(client.isEnabled()).toBe(false);
  });
});

describe("GhgCalculatorClient — calculate (mocked)", () => {
  it("sends correct request format", async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockCalculateResponse,
    });

    const client = new GhgCalculatorClient({
      apiUrl: "http://localhost:9000",
    });

    const result = await client.calculate({
      amount: 100,
      unit: "kWh",
      scope: "scope2",
      category: "electricity",
      date: "2024-08-27",
    });

    expect(result.totalCo2e).toBe(23.3);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:9000/calculate",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("throws on non-200 response", async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: "Bad Request",
    });

    const client = new GhgCalculatorClient({
      apiUrl: "http://localhost:9000",
    });

    await expect(
      client.calculate({
        amount: 100,
        unit: "kWh",
        scope: "scope2",
        category: "electricity",
        date: "2024-08-27",
      }),
    ).rejects.toThrow("400");
  });

  it("throws if client is disabled", async () => {
    const client = new GhgCalculatorClient({
      apiUrl: "http://localhost:9000",
      enabled: false,
    });

    await expect(
      client.calculate({
        amount: 100,
        unit: "kWh",
        scope: "scope2",
        category: "electricity",
        date: "2024-08-27",
      }),
    ).rejects.toThrow("disabled");
  });
});

describe("compareCalculations — deviation metrics", () => {
  it("calculates percentage deviance correctly", async () => {
    // Mock the ghg-calculator client
    const mockClient = {
      isEnabled: () => true,
      calculate: vi.fn().mockResolvedValue(mockCalculateResponse),
    } as unknown as GhgCalculatorClient;

    const result = await compareCalculations(
      100,
      "kWh",
      { co2e: 0.233 }, // Current engine result: 23.3
      mockClient,
    );

    expect(result.currentEngine.totalCo2e).toBeCloseTo(23.3);
    expect(result.ghgCalculator?.totalCo2e).toBe(23.3);
    expect(result.deviance).toBeDefined();
    expect(result.deviance?.percentageDifference).toBeCloseTo(0, 1); // Within 0.01%
    expect(result.deviance?.withinTolerance).toBe(true);
  });

  it("flags deviance outside tolerance", async () => {
    const mockClient = {
      isEnabled: () => true,
      calculate: vi.fn().mockResolvedValue({
        ...mockCalculateResponse,
        totalCo2e: 25.0, // ~7.3% higher
      }),
    } as unknown as GhgCalculatorClient;

    const result = await compareCalculations(
      100,
      "kWh",
      { co2e: 0.233 },
      mockClient,
    );

    expect(result.deviance).toBeDefined();
    expect(result.deviance?.percentageDifference).toBeGreaterThan(1);
    expect(result.deviance?.withinTolerance).toBe(false);
  });

  it("handles missing ghg-calculator gracefully", async () => {
    const result = await compareCalculations(100, "kWh", { co2e: 0.233 });

    expect(result.currentEngine.totalCo2e).toBeCloseTo(23.3);
    expect(result.ghgCalculator).toBeNull();
    expect(result.deviance).toBeNull();
  });
});

describe("aggregateComparisons — summary metrics", () => {
  it("calculates tolerance rate", () => {
    const results = [
      {
        currentEngine: { totalCo2e: 100, co2: null, ch4: null, n2o: null, biogenicCo2e: null, formula: "", warnings: [] },
        ghgCalculator: { totalCo2e: 100.5, formula: "" },
        deviance: {
          absoluteDifference: 0.5,
          percentageDifference: 0.5,
          withinTolerance: true,
        },
        error: undefined,
      },
      {
        currentEngine: { totalCo2e: 100, co2: null, ch4: null, n2o: null, biogenicCo2e: null, formula: "", warnings: [] },
        ghgCalculator: { totalCo2e: 105, formula: "" },
        deviance: {
          absoluteDifference: 5,
          percentageDifference: 5,
          withinTolerance: false,
        },
        error: undefined,
      },
    ];

    const metrics = aggregateComparisons(results);

    expect(metrics.totalRecords).toBe(2);
    expect(metrics.successfulComparisons).toBe(2);
    expect(metrics.withinToleranceCount).toBe(1);
    expect(metrics.toleranceRate).toBeCloseTo(50);
  });

  it("handles all-failing comparisons", () => {
    const results = [
      {
        currentEngine: { totalCo2e: 100, co2: null, ch4: null, n2o: null, biogenicCo2e: null, formula: "", warnings: [] },
        ghgCalculator: null,
        deviance: null,
        error: "API timeout",
      },
    ];

    const metrics = aggregateComparisons(results);

    expect(metrics.failedComparisons).toBe(1);
    expect(metrics.successfulComparisons).toBe(0);
    expect(metrics.avgDeviance).toBe(0);
  });
});
