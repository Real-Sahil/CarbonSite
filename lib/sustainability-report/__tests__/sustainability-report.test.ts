import { describe, expect, it } from "vitest";
import { highlights, intensity, scope3Disclosure, wasteSummary, yearTable } from "../model";
import { renderSustainabilityReportHtml } from "@/lib/reports/templates/sustainability-report";
import type { SustainabilityReportData } from "../load";

const totals = (s1: number, s2: number, s3: number) => ({ s1, s2, s2Market: null, s3, total: s1 + s2 + s3 });

describe("scope3Disclosure", () => {
  const notes = [
    { code: "s3-capital-goods", status: "not_relevant" as const, explanation: "Small plant purchases, below our threshold." },
    { code: "s3-waste", status: "not_yet_measured" as const, explanation: "Carriers report from next year." },
  ];

  it("lists all 15 categories in order", () => {
    const rows = scope3Disclosure([], []);
    expect(rows).toHaveLength(15);
    expect(rows[0].label).toBe("1. Purchased goods and services");
    expect(rows[14].label).toBe("15. Investments");
  });

  it("reports a category with records, whatever its note says", () => {
    const rows = scope3Disclosure([{ code: "s3-waste", tonnes: 12 }], notes);
    const waste = rows.find((r) => r.code === "s3-waste")!;
    expect(waste.status).toBe("reported");
    expect(waste.tonnes).toBe(12);
  });

  it("uses the organisation's own status and reason when there are no records", () => {
    const rows = scope3Disclosure([], notes);
    expect(rows.find((r) => r.code === "s3-capital-goods")).toMatchObject({ status: "not_relevant", explanation: "Small plant purchases, below our threshold." });
    expect(rows.find((r) => r.code === "s3-waste")?.status).toBe("not_yet_measured");
  });

  it("never claims a category is not relevant on its own", () => {
    const rows = scope3Disclosure([], []);
    expect(rows.every((r) => r.status === "no_records")).toBe(true);
  });
});

describe("yearTable", () => {
  const history = [
    { periodLabel: "FY2024", totals: totals(100, 50, 850) },
    { periodLabel: "FY2025", totals: totals(80, 55, 800) },
  ];
  const base = { label: "FY2023 base year", s1: 120, s2: 60, s3: 900, total: 1080 };

  it("gives base year, previous and current", () => {
    const rows = yearTable(base, history, totals(80, 55, 800), "FY2025");
    expect(rows.map((r) => r.kind)).toEqual(["base", "previous", "current"]);
    expect(rows[1].label).toBe("FY2024");
  });

  it("drops the base year row when the previous period is the base year", () => {
    const rows = yearTable({ ...base, label: "FY2024 base year" }, history, totals(80, 55, 800), "FY2025");
    expect(rows.map((r) => r.kind)).toEqual(["previous", "current"]);
  });

  it("has only the current period for a first year with no base year", () => {
    const rows = yearTable(null, [history[1]], totals(80, 55, 800), "FY2025");
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("current");
  });
});

describe("intensity", () => {
  it("is tonnes per million of revenue", () => {
    const i = intensity(500, 100, { amount: 50_000_000, currency: "GBP" }, 250);
    expect(i).toMatchObject({ currency: "GBP", perMillionTotal: 10, perMillionS12: 2, perFte: 2 });
  });
  it("is null without revenue", () => {
    expect(intensity(500, 100, null, 250)).toBeNull();
    expect(intensity(500, 100, { amount: 0, currency: "GBP" }, null)).toBeNull();
  });
});

describe("wasteSummary", () => {
  it("is a share of all tonnes", () => {
    const w = wasteSummary([{ tonnes: 90, diverted: true }, { tonnes: 10, diverted: false }]);
    expect(w?.diversionRate).toBeCloseTo(0.9);
  });
  it("is null with no records and has no rate for zero tonnes", () => {
    expect(wasteSummary([])).toBeNull();
    expect(wasteSummary([{ tonnes: 0, diverted: true }])?.diversionRate).toBeNull();
  });
});

describe("highlights", () => {
  const base = {
    periodLabel: "FY2025",
    current: totals(80, 55, 800),
    baseYear: { label: "FY2023 base year", s1: 120, s2: 60, s3: 900, total: 1080 },
    intensity: null,
    waste: null,
    socialValuePounds: 0,
    topCategory: { name: "Purchased goods", tonnes: 600 },
  };

  it("shows only tiles whose figure exists", () => {
    const labels = highlights(base).map((t) => t.label);
    expect(labels).toContain("tCO₂e total, FY2025");
    expect(labels).toContain("Scope 1 and 2 vs FY2023 base year");
    expect(labels).not.toContain("of waste diverted from landfill");
    expect(labels.some((l) => l.includes("social value"))).toBe(false);
  });

  it("reports the Scope 1 and 2 change against the base year", () => {
    // (80+55) against (120+60) is −25%
    expect(highlights(base)[1].value).toBe("−25.0%");
  });
});

describe("renderSustainabilityReportHtml", () => {
  const data = (over: Partial<SustainabilityReportData> = {}): SustainabilityReportData => ({
    orgName: "Northgate Civils Ltd",
    pack: {
      orgName: "Northgate Civils Ltd",
      bid: { title: null, buyer: null, reference: null },
      snapshot: {
        id: "s1", version: 2, publishedAt: new Date("2026-03-01"), publishedBy: "A", periodLabel: "FY2025",
        periodStart: new Date("2025-01-01"), periodEnd: new Date("2025-12-31"),
        factorLibrary: "DEFRA 2025.2", methodology: "ghg-protocol-v2026-02", gwpVersion: "AR6", recordCount: 120, reviewStatus: "approved",
      },
      current: totals(80, 55, 800),
      categories: [],
      ppnScope3: [],
      history: [],
      baseYear: null,
      targets: [],
      netZeroYear: null,
      interimTargets: [],
      initiatives: [],
      assurance: { auditorSignOff: null, engagement: null },
      contracts: [],
      socialValuePounds: 0,
      signatory: { name: null, title: null, date: null },
    },
    tiles: [{ value: "935", label: "tCO₂e total, FY2025" }],
    years: yearTable(null, [], totals(80, 55, 800), "FY2025"),
    intensity: null,
    scope3: scope3Disclosure([], []),
    waste: null,
    socialValue: null,
    boundary: null,
    ...over,
  });

  it("leaves out sections with no data and still numbers the rest in order", () => {
    const html = renderSustainabilityReportHtml(data());
    expect(html).toContain("1. About this report");
    expect(html).toContain("2. Greenhouse gas emissions");
    expect(html).toContain("3. Scope 3 categories");
    expect(html).not.toContain("Targets and progress");
    expect(html).not.toContain(">Waste<");
    expect(html).toContain("4. Data quality and assurance");
    expect(html).toContain("5. Sign-off");
    expect(html).toContain("6. ESRS index");
  });

  it("states it is not ESRS compliant and says no revenue means no intensity", () => {
    const html = renderSustainabilityReportHtml(data());
    expect(html).toContain("not presented as compliant with ESRS");
    expect(html).toContain("no revenue is entered for this reporting period");
  });

  it("points the ESRS index at the sections that exist", () => {
    const html = renderSustainabilityReportHtml(data({ waste: { totalTonnes: 100, divertedTonnes: 90, diversionRate: 0.9 } }));
    expect(html).toContain("ESRS E5-5");
    expect(html).toMatch(/ESRS E1-6[^<]*<\/td><td>Section 2</);
  });

  it("escapes organisation text", () => {
    const html = renderSustainabilityReportHtml(data({ orgName: "A <b>&</b> Co" }));
    expect(html).not.toContain("<b>&</b>");
    expect(html).toContain("A &lt;b&gt;&amp;&lt;/b&gt; Co");
  });
});
