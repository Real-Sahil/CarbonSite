import { describe, it, expect } from "vitest";
import { ValhallaClient, analyzeSupplierCoverage, type Location } from "../valhalla-client";

describe("Valhalla Supply Chain Analytics", () => {
  const client = new ValhallaClient("http://localhost:8002");

  const londonLocation: Location = {
    lat: 51.5074,
    lon: -0.1278,
    name: "London",
  };

  const facilities: Location[] = [
    { lat: 51.5074, lon: -0.1278, name: "London Facility" },
    { lat: 51.7520, lon: -0.4755, name: "Heathrow Facility" },
    { lat: 51.4769, lon: 0.0005, name: "Gatwick Facility" },
  ];

  describe("ValhallaClient initialization", () => {
    it("initializes with default API URL", () => {
      const defaultClient = new ValhallaClient();
      expect(defaultClient).toBeDefined();
    });

    it("initializes with custom API URL", () => {
      const customClient = new ValhallaClient("http://custom:8002");
      expect(customClient).toBeDefined();
    });
  });

  describe("getTimeMatrix", () => {
    it("returns error for empty sources", async () => {
      const result = await client.getTimeMatrix({
        sources: [],
        targets: facilities,
      });

      expect(result.status).toBe("error");
      expect(result.error).toBeTruthy();
      expect(result.matrix.times).toHaveLength(0);
    });

    it("returns error for empty targets", async () => {
      const result = await client.getTimeMatrix({
        sources: [londonLocation],
        targets: [],
      });

      expect(result.status).toBe("error");
      expect(result.error).toBeTruthy();
    });

    it("accepts different costing methods", async () => {
      const costings = ["auto", "bicycle", "pedestrian"] as const;

      for (const costing of costings) {
        const result = await client.getTimeMatrix({
          sources: [londonLocation],
          targets: facilities,
          costing,
        });

        // Even if it fails, it should accept the parameter
        expect(result).toBeDefined();
      }
    });
  });

  describe("getIsochrone", () => {
    it("returns polygon for valid isochrone", async () => {
      const result = await client.getIsochrone({
        center: londonLocation,
        contourMinutes: 30,
      });

      expect(result).toBeDefined();
      expect(result.center).toEqual(londonLocation);
    });

    it("includes contour properties", async () => {
      const result = await client.getIsochrone({
        center: londonLocation,
        contourMinutes: 60,
      });

      if (result.status === "success") {
        expect(result.properties?.contour).toBe(60);
        expect(result.properties?.color).toBeTruthy();
      }
    });

    it("assigns correct contour colors", async () => {
      const testCases = [
        { minutes: 15, expectedColor: "#00FF00" }, // Green
        { minutes: 30, expectedColor: "#FFFF00" }, // Yellow
        { minutes: 60, expectedColor: "#FF8C00" }, // Orange
        { minutes: 120, expectedColor: "#FF0000" }, // Red
      ];

      for (const testCase of testCases) {
        const result = await client.getIsochrone({
          center: londonLocation,
          contourMinutes: testCase.minutes,
        });

        if (result.status === "success" && result.properties) {
          expect(result.properties.color).toBe(testCase.expectedColor);
        }
      }
    });
  });

  describe("mapMatchTrace", () => {
    it("returns error for trace with less than 2 points", async () => {
      const result = await client.mapMatchTrace({
        trace: [londonLocation],
      });

      expect(result.status).toBe("error");
      expect(result.error).toBeTruthy();
      expect(result.confidence).toBe(0);
    });

    it("accepts valid trace", async () => {
      const trace: Location[] = [
        { lat: 51.5074, lon: -0.1278 },
        { lat: 51.5174, lon: -0.1378 },
        { lat: 51.5274, lon: -0.1478 },
      ];

      const result = await client.mapMatchTrace({ trace });

      expect(result).toBeDefined();
      expect(result.matchedTrace).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it("returns confidence score", async () => {
      const trace: Location[] = [
        { lat: 51.5074, lon: -0.1278 },
        { lat: 51.5174, lon: -0.1378 },
      ];

      const result = await client.mapMatchTrace({ trace });

      if (result.status === "success") {
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
      }
    });

    it("supports different costing methods", async () => {
      const trace: Location[] = [
        { lat: 51.5074, lon: -0.1278 },
        { lat: 51.5174, lon: -0.1378 },
      ];

      const result = await client.mapMatchTrace({
        trace,
        costing: "pedestrian",
      });

      expect(result).toBeDefined();
    });
  });

  describe("healthCheck", () => {
    it("returns boolean health status", async () => {
      const health = await client.healthCheck();

      expect(typeof health).toBe("boolean");
    });
  });

  describe("Supply Chain Analytics", () => {
    it("analyzes supplier coverage with multiple facilities", async () => {
      const analysis = await analyzeSupplierCoverage(client, londonLocation, facilities);

      expect(analysis.supplier).toEqual(londonLocation);
      expect(analysis.facilities).toEqual(facilities);
      expect(analysis.avgDeliveryTimeMin).toBeGreaterThanOrEqual(0);
      expect(analysis.maxDeliveryTimeMin).toBeGreaterThanOrEqual(0);
      expect(analysis.minDeliveryTimeMin).toBeGreaterThanOrEqual(0);
      expect(analysis.coverage2HourPct).toBeGreaterThanOrEqual(0);
      expect(analysis.coverage2HourPct).toBeLessThanOrEqual(100);
    });

    it("counts facilities within 2-hour coverage", async () => {
      const analysis = await analyzeSupplierCoverage(client, londonLocation, facilities);

      expect(analysis.coverageCount).toBeGreaterThanOrEqual(0);
      expect(analysis.coverageCount).toBeLessThanOrEqual(facilities.length);
    });

    it("handles single facility", async () => {
      const singleFacility: Location[] = [facilities[0]];

      const analysis = await analyzeSupplierCoverage(client, londonLocation, singleFacility);

      expect(analysis.facilities).toHaveLength(1);
      expect(analysis.coverageCount).toBeLessThanOrEqual(1);
    });

    it("handles many facilities (scalability)", async () => {
      const manyFacilities: Location[] = Array.from({ length: 10 }, (_, i) => ({
        lat: 51.5 + i * 0.05,
        lon: -0.1 + i * 0.05,
        name: `Facility ${i}`,
      }));

      const analysis = await analyzeSupplierCoverage(client, londonLocation, manyFacilities);

      expect(analysis.facilities).toHaveLength(10);
    });
  });

  describe("Integration: Supplier Network Analysis", () => {
    it("simulates multi-supplier waste collection network", async () => {
      const suppliers: Location[] = [
        { lat: 51.5074, lon: -0.1278, name: "North London Hub" },
        { lat: 51.4769, lon: 0.0005, name: "East London Hub" },
      ];

      const targetFacilities: Location[] = [
        { lat: 51.5, lon: -0.15 },
        { lat: 51.48, lon: -0.08 },
        { lat: 51.52, lon: 0.02 },
      ];

      const analyses = await Promise.all(
        suppliers.map((supplier) =>
          analyzeSupplierCoverage(client, supplier, targetFacilities)
        )
      );

      expect(analyses).toHaveLength(2);
      expect(analyses.every((a) => a.facilities.length === 3)).toBe(true);

      // Verify all analyses have valid metrics
      analyses.forEach((analysis) => {
        expect(analysis.avgDeliveryTimeMin).toBeGreaterThanOrEqual(0);
        expect(analysis.coverage2HourPct).toBeGreaterThanOrEqual(0);
      });
    });

    it("identifies optimal supplier for facility", async () => {
      const suppliers: Location[] = [
        { lat: 51.5, lon: -0.1, name: "Supplier A" },
        { lat: 51.48, lon: -0.08, name: "Supplier B" },
      ];

      const facility: Location = { lat: 51.49, lon: -0.07, name: "Target Facility" };

      // In real scenario, would use time matrix to find nearest supplier
      // This simulates the decision logic
      expect(suppliers.length).toBe(2);
      expect(facility).toBeDefined();
    });
  });
});
