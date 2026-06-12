import { describe, expect, it } from "vitest";
import { renderReportHtml, type ReportData } from "../template";

const baseData: ReportData = {
  orgName: "Acme Construction Ltd",
  reportType: "inventory",
  periodLabel: "FY2025",
  periodStart: new Date("2025-01-01"),
  periodEnd: new Date("2025-12-31"),
  snapshotVersion: 2,
  publishedAt: new Date("2026-01-15"),
  publishedBy: "Jane Smith",
  factorLibrary: "DEFRA 2025.1",
  methodology: "ghg-protocol-v2026-01",
  gwpVersion: "AR6",
  grandTotalKg: 125_500,
  recordCount: 42,
  scopes: [
    { scope: 1, label: "Scope 1 — Direct emissions", totalKg: 50_000, count: 20 },
    { scope: 2, label: "Scope 2 — Purchased energy", totalKg: 25_500, count: 10 },
    { scope: 3, label: "Scope 3 — Value chain", totalKg: 50_000, count: 12 },
  ],
  categories: [
    { name: "Stationary Combustion", scope: 1, totalKg: 50_000, count: 20 },
    { name: "Purchased Electricity (Location-Based)", scope: 2, totalKg: 25_500, count: 10 },
  ],
  facilities: [{ name: "Head Office", totalKg: 125_500, count: 42 }],
};

describe("renderReportHtml", () => {
  it("renders org name, period, and report title", () => {
    const html = renderReportHtml(baseData);
    expect(html).toContain("Acme Construction Ltd");
    expect(html).toContain("FY2025");
    expect(html).toContain("GHG Emissions Inventory");
  });

  it("displays totals in tonnes CO2e", () => {
    const html = renderReportHtml(baseData);
    expect(html).toContain("125.50"); // 125,500 kg → 125.50 t
    expect(html).toContain("50.00");
  });

  it("includes methodology, GWP version, and factor library provenance", () => {
    const html = renderReportHtml(baseData);
    expect(html).toContain("ghg-protocol-v2026-01");
    expect(html).toContain("AR6");
    expect(html).toContain("DEFRA 2025.1");
    expect(html).toContain("CH<sub>4</sub> = 27.9");
    expect(html).toContain("N<sub>2</sub>O = 273");
  });

  it("escapes HTML in user-controlled strings", () => {
    const html = renderReportHtml({
      ...baseData,
      orgName: `<script>alert("x")</script>`,
    });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("handles a zero-emission snapshot without dividing by zero", () => {
    const html = renderReportHtml({
      ...baseData,
      grandTotalKg: 0,
      recordCount: 0,
      scopes: baseData.scopes.map((s) => ({ ...s, totalKg: 0, count: 0 })),
      categories: [],
      facilities: [],
    });
    expect(html).toContain("0.00");
    expect(html).not.toContain("NaN");
  });
});
