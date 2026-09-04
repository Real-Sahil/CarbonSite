import { describe, it, expect } from "vitest";
import {
  DATA_ORIGIN_ORDER,
  DATA_ORIGIN_META,
  isPrimaryData,
  requiresJustification,
  parseDataOrigin,
  summariseProvenance,
} from "../provenance";

describe("provenance tiers", () => {
  it("covers every tier with metadata", () => {
    for (const origin of DATA_ORIGIN_ORDER) {
      expect(DATA_ORIGIN_META[origin]).toBeDefined();
      expect(DATA_ORIGIN_META[origin].label.length).toBeGreaterThan(0);
    }
  });

  it("orders tiers from strongest to weakest reliability", () => {
    const scores = DATA_ORIGIN_ORDER.map((o) => DATA_ORIGIN_META[o].reliabilityScore);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
    }
  });

  it("classifies observed-at-source tiers as primary", () => {
    expect(isPrimaryData("metered")).toBe(true);
    expect(isPrimaryData("invoiced")).toBe(true);
    expect(isPrimaryData("supplier_specific")).toBe(true);
    expect(isPrimaryData("estimated")).toBe(false);
    expect(isPrimaryData("proxy")).toBe(false);
    expect(isPrimaryData("extrapolated")).toBe(false);
  });

  it("requires justification only for the two weakest tiers", () => {
    expect(requiresJustification("proxy")).toBe(true);
    expect(requiresJustification("extrapolated")).toBe(true);
    expect(requiresJustification("estimated")).toBe(false);
    expect(requiresJustification("metered")).toBe(false);
  });
});

describe("parseDataOrigin", () => {
  it("accepts the canonical enum values", () => {
    expect(parseDataOrigin("metered")).toBe("metered");
    expect(parseDataOrigin("supplier_specific")).toBe("supplier_specific");
  });

  it("normalises spacing, casing and hyphens", () => {
    expect(parseDataOrigin("  Supplier Specific ")).toBe("supplier_specific");
    expect(parseDataOrigin("SUPPLIER-SPECIFIC")).toBe("supplier_specific");
  });

  it("maps the phrasings people actually type", () => {
    expect(parseDataOrigin("meter reading")).toBe("metered");
    expect(parseDataOrigin("actual")).toBe("metered");
    expect(parseDataOrigin("bill")).toBe("invoiced");
    expect(parseDataOrigin("delivery note")).toBe("invoiced");
    expect(parseDataOrigin("EPD")).toBe("supplier_specific");
    expect(parseDataOrigin("modelled")).toBe("estimated");
    expect(parseDataOrigin("average")).toBe("estimated");
    expect(parseDataOrigin("pro rated")).toBe("extrapolated");
  });

  it("returns null for anything unrecognised so the caller decides the fallback", () => {
    expect(parseDataOrigin("banana")).toBeNull();
    expect(parseDataOrigin("")).toBeNull();
    expect(parseDataOrigin("   ")).toBeNull();
    expect(parseDataOrigin(null)).toBeNull();
    expect(parseDataOrigin(42)).toBeNull();
    expect(parseDataOrigin(undefined)).toBeNull();
  });
});

describe("summariseProvenance", () => {
  it("weights the split by emissions, not by record count", () => {
    // One metered record carrying almost all the emissions must not be
    // outvoted by three trivial estimated ones.
    const summary = summariseProvenance([
      { dataOrigin: "metered", totalCo2e: 900 },
      { dataOrigin: "estimated", totalCo2e: 40 },
      { dataOrigin: "estimated", totalCo2e: 30 },
      { dataOrigin: "estimated", totalCo2e: 30 },
    ]);

    expect(summary.totalCo2e).toBe(1000);
    expect(summary.totalRecords).toBe(4);
    expect(summary.primaryDataPercent).toBeCloseTo(90, 6);
  });

  it("reports the low-confidence share from the two weakest tiers", () => {
    const summary = summariseProvenance([
      { dataOrigin: "metered", totalCo2e: 500 },
      { dataOrigin: "proxy", totalCo2e: 300 },
      { dataOrigin: "extrapolated", totalCo2e: 200 },
    ]);
    expect(summary.lowConfidencePercent).toBeCloseTo(50, 6);
  });

  it("returns zeroed percentages rather than NaN for an empty inventory", () => {
    const summary = summariseProvenance([]);
    expect(summary.totalCo2e).toBe(0);
    expect(summary.rows).toEqual([]);
    expect(summary.primaryDataPercent).toBe(0);
    expect(summary.lowConfidencePercent).toBe(0);
  });

  it("returns zeroed percentages when every record is zero", () => {
    const summary = summariseProvenance([
      { dataOrigin: "metered", totalCo2e: 0 },
      { dataOrigin: "estimated", totalCo2e: 0 },
    ]);
    expect(summary.primaryDataPercent).toBe(0);
    expect(summary.rows).toHaveLength(2);
  });

  it("ignores non-finite emissions rather than poisoning the total", () => {
    const summary = summariseProvenance([
      { dataOrigin: "metered", totalCo2e: 100 },
      { dataOrigin: "estimated", totalCo2e: Number.NaN },
    ]);
    expect(summary.totalCo2e).toBe(100);
    expect(summary.primaryDataPercent).toBeCloseTo(100, 6);
  });

  it("emits rows in strongest-to-weakest order", () => {
    const summary = summariseProvenance([
      { dataOrigin: "extrapolated", totalCo2e: 10 },
      { dataOrigin: "metered", totalCo2e: 10 },
      { dataOrigin: "estimated", totalCo2e: 10 },
    ]);
    expect(summary.rows.map((r) => r.origin)).toEqual(["metered", "estimated", "extrapolated"]);
  });

  it("sums percentages to 100 across the rows", () => {
    const summary = summariseProvenance([
      { dataOrigin: "metered", totalCo2e: 333 },
      { dataOrigin: "invoiced", totalCo2e: 333 },
      { dataOrigin: "proxy", totalCo2e: 334 },
    ]);
    const total = summary.rows.reduce((s, r) => s + r.percentOfEmissions, 0);
    expect(total).toBeCloseTo(100, 6);
  });
});
