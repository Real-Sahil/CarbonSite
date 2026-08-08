import { describe, it, expect } from "vitest";
import { renderGhgProtocolHtml, type GhgProtocolData } from "@/lib/reports/templates/ghg-protocol";

const baseData: GhgProtocolData = {
  orgName: "Test Construction Ltd",
  periodLabel: "FY 2025",
  periodStart: new Date("2025-01-01"),
  periodEnd: new Date("2025-12-31"),
  snapshotVersion: 1,
  publishedAt: new Date("2025-12-15"),
  publishedBy: "Jane Smith",
  factorLibrary: "DEFRA 2025.1",
  methodology: "ghg-protocol-v2026-01",
  gwpVersion: "AR6",
  scope1Kg: 50_000,
  scope2LocationKg: 30_000,
  scope2MarketKg: 28_000,
  scope3Kg: 120_000,
  totalKg: 200_000,
  recordCount: 42,
  categories: [
    { code: "s1-stationary", name: "Stationary combustion", scope: 1, totalKg: 30_000 },
    { code: "s1-mobile", name: "Mobile combustion", scope: 1, totalKg: 20_000 },
    { code: "s2-electricity-lb", name: "Electricity (location)", scope: 2, totalKg: 30_000 },
    { code: "s3-purchased-goods", name: "Purchased goods and services", scope: 3, totalKg: 120_000 },
  ],
};

describe("renderGhgProtocolHtml", () => {
  it("returns a string containing DOCTYPE", () => {
    const html = renderGhgProtocolHtml(baseData);
    expect(typeof html).toBe("string");
    expect(html).toContain("<!DOCTYPE html");
  });

  it("includes organisation name in title and header", () => {
    const html = renderGhgProtocolHtml(baseData);
    expect(html).toContain("Test Construction Ltd");
  });

  it("includes scope totals as formatted values", () => {
    const html = renderGhgProtocolHtml(baseData);
    // Scope 1: 50,000 kg = 50.000 t
    expect(html).toContain("50.000");
  });

  it("shows all three scope KPI cards", () => {
    const html = renderGhgProtocolHtml(baseData);
    expect(html).toContain("Scope 1");
    expect(html).toContain("Scope 2");
    expect(html).toContain("Scope 3");
  });

  it("includes methodology metadata", () => {
    const html = renderGhgProtocolHtml(baseData);
    expect(html).toContain("ghg-protocol-v2026-01");
    expect(html).toContain("AR6");
    expect(html).toContain("DEFRA 2025.1");
  });

  it("includes category breakdown in tables", () => {
    const html = renderGhgProtocolHtml(baseData);
    expect(html).toContain("Stationary combustion");
    expect(html).toContain("Purchased goods and services");
  });

  it("shows per-gas breakdown when gas data is provided", () => {
    const html = renderGhgProtocolHtml({
      ...baseData,
      co2Kg: 45_000,
      ch4Kg: 2_000,
      n2oKg: 3_000,
    });
    expect(html).toContain("CO₂");
    expect(html).toContain("CH₄");
    expect(html).toContain("N₂O");
  });

  it("includes baseline comparison when provided", () => {
    const html = renderGhgProtocolHtml({
      ...baseData,
      baselineYear: "2020",
      baselineTonnes: 300,
      reductionPct: 33.3,
    });
    expect(html).toContain("2020");
    expect(html).toContain("33.3");
  });

  it("renders without error when optional fields are omitted", () => {
    const minimalData: GhgProtocolData = {
      ...baseData,
      co2Kg: undefined,
      ch4Kg: undefined,
      n2oKg: undefined,
      biogenicCo2Kg: undefined,
      baselineYear: undefined,
      baselineTonnes: undefined,
      reductionPct: undefined,
    };
    expect(() => renderGhgProtocolHtml(minimalData)).not.toThrow();
  });

  it("produces HTML with record count", () => {
    const html = renderGhgProtocolHtml(baseData);
    expect(html).toContain("42");
  });
});
