import { describe, expect, it } from "vitest";
import { filterSuppliers, healthOf } from "../filter";

const rows = [
  { supplierName: "Acme Aggregates Ltd", dataQualityScore: 92, trend: "improving" as const },
  { supplierName: "Brick & Co", dataQualityScore: 70, trend: "stable" as const },
  { supplierName: "Acme Haulage", dataQualityScore: 40, trend: "declining" as const },
];

describe("healthOf", () => {
  it("bands at 80 and 60 inclusive", () => {
    expect([100, 80, 79.9, 60, 59.9, 0].map(healthOf)).toEqual(["healthy", "healthy", "at_risk", "at_risk", "critical", "critical"]);
  });
});

describe("filterSuppliers", () => {
  it("returns everything with no filters", () => {
    expect(filterSuppliers(rows, {})).toHaveLength(3);
  });
  it("matches part of a name, ignoring case and surrounding space", () => {
    expect(filterSuppliers(rows, { q: "  ACME " }).map((r) => r.supplierName)).toEqual(["Acme Aggregates Ltd", "Acme Haulage"]);
  });
  it("narrows by health band and by trend, and combines them", () => {
    expect(filterSuppliers(rows, { health: "critical" }).map((r) => r.supplierName)).toEqual(["Acme Haulage"]);
    expect(filterSuppliers(rows, { trend: "stable" }).map((r) => r.supplierName)).toEqual(["Brick & Co"]);
    expect(filterSuppliers(rows, { q: "acme", health: "healthy" }).map((r) => r.supplierName)).toEqual(["Acme Aggregates Ltd"]);
    expect(filterSuppliers(rows, { q: "brick", trend: "declining" })).toEqual([]);
  });
});
