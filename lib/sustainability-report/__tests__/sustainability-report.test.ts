import { describe, expect, it } from "vitest";
import { fuelSummary, highlights, intensity, perMillion, scope3Disclosure, waterSummary, wasteSummary, yearTable } from "../model";
import { renderSustainabilityReportHtml } from "@/lib/reports/templates/sustainability-report";
import type { SustainabilityReportData } from "../load";
import { formatters } from "@/lib/i18n/org-format";

const GB = { locale: "en-GB", currency: "GBP" };

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

describe("fuelSummary", () => {
  it("counts a blend by its HVO share and unnamed fuel as fossil", () => {
    const f = fuelSummary([
      { litres: 1000, fuelType: "HVO100" },
      { litres: 1000, fuelType: "HVO50" },
      { litres: 2000, fuelType: "diesel" },
      { litres: 1000, fuelType: null },
    ]);
    expect(f?.totalLitres).toBe(5000);
    expect(f?.hvoLitres).toBe(1500);
    expect(f?.hvoShare).toBeCloseTo(0.3);
  });
  it("is null with no litres", () => {
    expect(fuelSummary([])).toBeNull();
    expect(fuelSummary([{ litres: 0, fuelType: "HVO" }])).toBeNull();
  });
});

describe("waterSummary and perMillion", () => {
  it("totals each metric and is null with no records", () => {
    expect(waterSummary([])).toBeNull();
    expect(waterSummary([{ metric: "withdrawal", m3: 10 }, { metric: "withdrawal", m3: 5 }, { metric: "discharge", m3: 4 }])).toEqual({
      withdrawalM3: 15, dischargeM3: 4, consumptionM3: 0,
    });
  });
  it("divides by the revenue in millions", () => {
    expect(perMillion(30, { amount: 15_000_000 })).toBe(2);
    expect(perMillion(30, null)).toBeNull();
    expect(perMillion(30, { amount: 0 })).toBeNull();
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
    fmt: formatters(GB),
  };

  it("adds the HVO share and waste intensity tiles when they exist", () => {
    const labels = highlights({
      ...base,
      intensity: { currency: "EUR", perMillionTotal: 1, perMillionS12: 1, perFte: null },
      wasteIntensity: 12.5,
      fuel: { totalLitres: 100, hvoLitres: 40, hvoShare: 0.4 },
    }).map((t) => t.label);
    expect(labels).toContain("of fuel litres is HVO");
    expect(labels).toContain("tonnes of waste per million EUR revenue");
  });

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
    wasteIntensity: null,
    fuel: null,
    water: null,
    materiality: null,
    socialValue: null,
    boundary: null,
    format: GB,
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

  it("prints the approved assessment's material topics with their basis, and numbers the sections in order", () => {
    const topic = (over: object) => ({ esrsCode: "E1", topicName: "Climate change mitigation", iroType: "impact", impactScore: 5, financialScore: 2, isMaterial: true, rationale: "Our fleet and plant burn fuel <a lot>.", ...over });
    const html = renderSustainabilityReportHtml(
      data({
        materiality: {
          name: "2026 assessment", status: "approved", approvedAt: new Date("2026-02-01"), method: "Workshops and a scoring matrix.", stakeholders: null,
          groups: [{ code: "E1", topics: [topic({}), topic({ topicName: "Energy", impactScore: 2, financialScore: 4, rationale: null })] }],
        },
      }),
    );
    expect(html).toContain("2. Material topics");
    expect(html).toContain("3. Greenhouse gas emissions");
    expect(html).toContain("Impact</td>");
    expect(html).toContain("Financial</td>");
    expect(html).toContain("Our fleet and plant burn fuel &lt;a lot&gt;.");
    expect(html).toContain("ESRS 2 IRO-1");
  });

  it("leaves the section out when no topic is material", () => {
    const html = renderSustainabilityReportHtml(
      data({ materiality: { name: "x", status: "approved", approvedAt: null, method: null, stakeholders: null, groups: [] } }),
    );
    expect(html).not.toContain("Material topics");
  });

  it("adds water and fuel sections, numbered, and points the ESRS index at them", () => {
    const html = renderSustainabilityReportHtml(
      data({
        water: { withdrawalM3: 1200, dischargeM3: 900, consumptionM3: 300, withdrawalPerMillion: 50 },
        fuel: { totalLitres: 10000, hvoLitres: 4000, hvoShare: 0.4 },
        intensity: { currency: "GBP", perMillionTotal: 1, perMillionS12: 1, perFte: null },
      }),
    );
    expect(html).toContain("Water</h2>");
    expect(html).toContain("Fuel</h2>");
    expect(html).toContain("ESRS E3-4");
    expect(html).toContain("ESRS E1-5");
    expect(html).toContain("40.0%");
  });

  it("formats numbers, dates and money the way the organisation's country does", () => {
    const de = renderSustainabilityReportHtml(data({ format: { locale: "de-DE", currency: "EUR" } }));
    expect(de).toContain("1. März 2026"); // published date, German month name and order
    expect(de).toContain("935,0"); // decimal comma
    const us = renderSustainabilityReportHtml(data({ format: { locale: "en-US", currency: "USD" } }));
    expect(us).toContain("March 1, 2026");
  });

  it("shows social value in GBP whatever the reporting currency, since National TOMs records GBP", () => {
    const html = renderSustainabilityReportHtml(
      data({ format: { locale: "en-US", currency: "USD" }, socialValue: { totalPounds: 5000, byTheme: [] } }),
    );
    expect(html).toContain("£5,000");
    expect(html).not.toContain("$5,000");
  });

  it("escapes organisation text", () => {
    const html = renderSustainabilityReportHtml(data({ orgName: "A <b>&</b> Co" }));
    expect(html).not.toContain("<b>&</b>");
    expect(html).toContain("A &lt;b&gt;&amp;&lt;/b&gt; Co");
  });
});
