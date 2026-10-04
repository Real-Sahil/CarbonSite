import { describe, it, expect } from "vitest";
import { withLocale, loc } from "@/lib/reports/templates/locale";
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

describe("report locale", () => {
  it("prints dates and numbers the way the organisation's country does", () => {
    const de = withLocale("DE", () => renderGhgProtocolHtml(baseData));
    expect(de).toContain("15. Dezember 2025");
    expect(de).toContain("50,000");
    const gb = withLocale("GB", () => renderGhgProtocolHtml(baseData));
    expect(gb).toContain("15 December 2025");
    expect(gb).toContain("50.000");
  });
  it("defaults to en-GB and restores the previous locale, even when rendering throws", () => {
    expect(loc()).toBe("en-GB");
    expect(() => withLocale("DE", () => { throw new Error("x"); })).toThrow();
    expect(loc()).toBe("en-GB");
    withLocale(undefined, () => expect(loc()).toBe("en-GB"));
  });
});

describe("renderGhgProtocolHtml team summary", () => {
  const narrative = { executive_summary: "Steady year.\nFuel dominated.", key_findings: ["Diesel is the largest source."], recommendations: "Attach every bill.", source: "team" as const };

  it("is exactly as before when no summary is saved", () => {
    const html = renderGhgProtocolHtml(baseData);
    expect(html).not.toContain("Written by the reporting team");
    expect(html).not.toContain(">Summary<");
  });

  it("prints the team's summary, findings and recommendations with who wrote them, escaped", () => {
    const html = renderGhgProtocolHtml({ ...baseData, narrative: { ...narrative, executive_summary: "Steady <i>year</i>." } });
    expect(html).toContain("Written by the reporting team.");
    expect(html).toContain("Diesel is the largest source.");
    expect(html).toContain("Attach every bill.");
    expect(html).toContain("Steady &lt;i&gt;year&lt;/i&gt;.");
    expect(html).not.toContain("<i>year</i>");
  });

  it("says the draft began with AI when it did", () => {
    expect(renderGhgProtocolHtml({ ...baseData, narrative: { ...narrative, aiDrafted: true } })).toContain("AI-assisted draft that the team reviewed and edited");
  });
});
