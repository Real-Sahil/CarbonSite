import { describe, expect, it } from "vitest";
import {
  coverage, isLowCarbonPathway, mayClaimConsistency, parseSections, ratingOf, riskFamily, score, tcfdChecklist,
  type RiskRow, type ScenarioRow,
} from "../index";
import { renderTcfdStatementHtml } from "@/lib/reports/templates/tcfd-statement";
import type { ClimateDisclosureView } from "../load";

const long = "A sentence long enough to count as written down by the organisation.";
const scenario = (over: Partial<ScenarioRow> = {}): ScenarioRow => ({
  id: "s1", name: "Net zero", type: "transition", pathway: "1.5°C", horizon: "medium", description: null, valueAtRiskLow: null, valueAtRiskHigh: null, ...over,
});
const risk = (over: Partial<RiskRow> = {}): RiskRow => ({
  id: "r", scenarioId: "s1", category: "Policy and legal", description: "A carbon price on materials.", likelihood: 3, impact: 4,
  residualLikelihood: null, residualImpact: null, financialLow: null, financialHigh: null, actions: long, reviewDate: null, ...over,
});
const full = () => ({
  ...parseSections({}),
  governanceBoard: long, governanceManagement: long, strategyImpact: long, scenarioNarrative: long,
  riskIdentification: long, riskManagement: long, riskIntegration: long, metricsNarrative: long,
});
const scenarios = [scenario(), scenario({ id: "s2", name: "Hot world", type: "physical", pathway: "4°C" })];
const risks = [risk(), risk({ id: "p", scenarioId: "s2", category: "Acute physical" })];
const all = { sections: full(), scenarios, risks, totals: { periodLabel: "FY2025", scope3Tonnes: 100 }, hasTarget: true };

describe("risk scoring", () => {
  it("is likelihood times impact, banded", () => {
    expect(score(3, 4)).toBe(12);
    expect([1, 4, 5, 9, 10, 15, 16, 25].map(ratingOf)).toEqual(["low", "low", "medium", "medium", "high", "high", "very_high", "very_high"]);
  });
});

describe("isLowCarbonPathway", () => {
  it("reads the organisation's own wording", () => {
    for (const p of ["1.5°C", "2°C", "Net Zero 2050", "Well below 2°C", "Paris-aligned", "2 C"]) expect(isLowCarbonPathway(p)).toBe(true);
    for (const p of ["4°C", "3.2°C", "Current policies", "", null]) expect(isLowCarbonPathway(p)).toBe(false);
  });
});

describe("riskFamily", () => {
  it("takes the scenario's type unless the text says opportunity", () => {
    expect(riskFamily({ category: "Market", description: "x" }, { type: "physical" })).toBe("physical");
    expect(riskFamily({ category: "Resource efficiency opportunity", description: "x" }, { type: "transition" })).toBe("opportunity");
  });
});

describe("tcfdChecklist", () => {
  it("has the eleven recommended disclosures, all missing for an empty organisation", () => {
    const checks = tcfdChecklist({ sections: parseSections({}), scenarios: [], risks: [], totals: null, hasTarget: false });
    expect(checks).toHaveLength(11);
    expect(checks.every((c) => c.status === "gap")).toBe(true);
  });

  it("meets all eleven when everything is written, assessed and published", () => {
    expect(coverage(tcfdChecklist(all))).toEqual({ met: 11, total: 11 });
  });

  it("asks for both physical and transition risk before strategy (a) is met", () => {
    const only = tcfdChecklist({ ...all, risks: [risk()] }).find((c) => c.id === "str-a")!;
    expect(only.status).toBe("partial");
    expect(only.detail).toContain("No physical risk assessed");
  });

  it("needs two scenarios, one of them 2°C or lower, and the narrative", () => {
    const c = tcfdChecklist({ ...all, scenarios: [scenario({ pathway: "4°C" })] }).find((x) => x.id === "str-c")!;
    expect(c.status).toBe("partial");
    expect(c.detail).toContain("at least two scenarios");
    expect(c.detail).toContain("2°C or lower");
  });

  it("is only partly met when an assessed risk has no action", () => {
    const c = tcfdChecklist({ ...all, risks: [...risks, risk({ id: "x", actions: null })] }).find((x) => x.id === "rm-b")!;
    expect(c.status).toBe("partial");
  });

  it("is partial on emissions without Scope 3, and a gap without published totals", () => {
    const status = (totals: { periodLabel: string; scope3Tonnes: number } | null) =>
      tcfdChecklist({ ...all, totals }).find((c) => c.id === "mt-b")!.status;
    expect(status({ periodLabel: "FY2025", scope3Tonnes: 0 })).toBe("partial");
    expect(status(null)).toBe("gap");
  });
});

describe("mayClaimConsistency", () => {
  it("needs every disclosure met and the board's approval", () => {
    const checks = tcfdChecklist(all);
    expect(mayClaimConsistency(checks, true)).toBe(true);
    expect(mayClaimConsistency(checks, false)).toBe(false);
    expect(mayClaimConsistency(tcfdChecklist({ ...all, hasTarget: false }), true)).toBe(false);
  });
});

describe("parseSections", () => {
  it("falls back to an empty statement for malformed stored data, and ignores old keys", () => {
    expect(parseSections("nonsense").governanceBoard).toBe("");
    expect(parseSections({ scenarios: [{ name: "x" }], governanceBoard: "kept" }).governanceBoard).toBe("kept");
  });
});

describe("renderTcfdStatementHtml", () => {
  const view = (over: Partial<ClimateDisclosureView & { orgName: string }> = {}): ClimateDisclosureView & { orgName: string } => ({
    orgName: "Acme <Pty> Ltd",
    exists: true, status: "approved", approvalBody: "Board of directors", approvedAt: new Date("2026-02-01"), updatedAt: new Date(),
    sections: full(), scenarios, risks: [risk({ financialLow: 1000, financialHigh: 5000 }), risks[1]],
    snapshot: { id: "s", version: 2, publishedAt: new Date("2026-03-01"), label: "FY2025", startDate: new Date("2025-01-01"), endDate: new Date("2025-12-31") } as never,
    totals: { s1: 10, s2: 5, s2Market: null, s3: 100, total: 115 },
    targets: [], netZeroYear: 2045, format: { locale: "en-GB", currency: "GBP" },
    checklist: tcfdChecklist(all),
    ...over,
  });

  it("claims consistency only when all eleven are met and approved", () => {
    expect(renderTcfdStatementHtml(view())).toContain("consistent with the eleven recommended disclosures");
    const draft = renderTcfdStatementHtml(view({ status: "draft", approvedAt: null }));
    expect(draft).not.toContain("consistent with the eleven");
    expect(draft).toContain("has not yet been approved");
  });

  it("states how many are addressed when some are missing", () => {
    const html = renderTcfdStatementHtml(view({ checklist: tcfdChecklist({ ...all, hasTarget: false }) }));
    expect(html).toContain("addresses 10 of the 11 recommended disclosures");
  });

  it("prints the scenarios, the risks and the organisation's own currency", () => {
    const html = renderTcfdStatementHtml(view({ format: { locale: "en-US", currency: "USD" } }));
    expect(html).toContain("Hot world");
    expect(html).toContain("Acute physical");
    expect(html).toContain("$1,000 to $5,000");
    expect(html).toContain("Amounts are in USD");
  });

  it("maps each disclosure to its IFRS S2 area and formats for the organisation's country", () => {
    const html = renderTcfdStatementHtml(view({ format: { locale: "de-DE", currency: "EUR" } }));
    expect(html).toContain("Strategy: climate resilience, using scenario analysis");
    expect(html).toContain("115,0");
  });

  it("escapes organisation text and keeps jurisdiction-neutral wording", () => {
    const html = renderTcfdStatementHtml(view());
    expect(html).toContain("Acme &lt;Pty&gt; Ltd");
    expect(html).toContain("depends on the organisation's jurisdiction");
  });
});
