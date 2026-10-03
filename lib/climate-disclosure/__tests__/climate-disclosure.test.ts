import { describe, expect, it } from "vitest";
import {
  coverage, mayClaimConsistency, parseSections, ratingOf, score, tcfdChecklist,
  type DisclosureSections, type RiskRow,
} from "../index";
import { renderTcfdStatementHtml } from "@/lib/reports/templates/tcfd-statement";
import type { ClimateDisclosureView } from "../load";

const long = "A sentence long enough to count as written down by the organisation.";
const risk = (over: Partial<RiskRow> = {}): RiskRow => ({
  id: "r", kind: "physical_acute", title: "Flooding", description: null, horizon: "medium",
  inherentLikelihood: 3, inherentImpact: 4, residualLikelihood: null, residualImpact: null,
  mitigation: long, financialEffect: null, ownerRole: null, status: "open", ...over,
});
const full = (): DisclosureSections => ({
  ...parseSections({}),
  governanceBoard: long, governanceManagement: long, strategyImpact: long, scenarioNarrative: long,
  riskIdentification: long, riskManagement: long, riskIntegration: long, metricsNarrative: long,
  horizons: { short: "0 to 2 years", medium: "2 to 10 years", long: "10 to 30 years" },
  scenarios: [
    { id: "a", name: "Net zero", source: "", lowCarbon: true, transition: "", physical: "" },
    { id: "b", name: "Current policies", source: "", lowCarbon: false, transition: "", physical: "" },
  ],
});
const all = { sections: full(), risks: [risk(), risk({ id: "t", kind: "transition_policy" })], totals: { periodLabel: "FY2025", scope3Tonnes: 100 }, hasTarget: true };

describe("risk scoring", () => {
  it("is likelihood times impact, banded", () => {
    expect(score(3, 4)).toBe(12);
    expect([1, 4, 5, 9, 10, 15, 16, 25].map(ratingOf)).toEqual(["low", "low", "medium", "medium", "high", "high", "very_high", "very_high"]);
  });
});

describe("tcfdChecklist", () => {
  it("has the eleven recommended disclosures, all missing for an empty organisation", () => {
    const checks = tcfdChecklist({ sections: parseSections({}), risks: [], totals: null, hasTarget: false });
    expect(checks).toHaveLength(11);
    expect(checks.every((c) => c.status === "gap")).toBe(true);
  });

  it("meets all eleven when everything is written, scored and published", () => {
    const checks = tcfdChecklist(all);
    expect(coverage(checks)).toEqual({ met: 11, total: 11 });
  });

  it("asks for physical and transition risk and the time horizons before strategy (a) is met", () => {
    const only = tcfdChecklist({ ...all, risks: [risk()], sections: { ...full(), horizons: { short: "", medium: "", long: "" } } });
    const strA = only.find((c) => c.id === "str-a")!;
    expect(strA.status).toBe("partial");
    expect(strA.detail).toContain("Define what short, medium and long term mean");
    expect(strA.detail).toContain("No transition risk recorded");
  });

  it("needs two scenarios, one of them 2°C or lower, and the narrative", () => {
    const s = { ...full(), scenarios: [full().scenarios[1]] };
    const c = tcfdChecklist({ ...all, sections: s }).find((x) => x.id === "str-c")!;
    expect(c.status).toBe("partial");
    expect(c.detail).toContain("at least two scenarios");
    expect(c.detail).toContain("2°C or lower");
  });

  it("is only partly met when an open risk has no response, and a closed one does not count", () => {
    const open = tcfdChecklist({ ...all, risks: [...all.risks, risk({ id: "x", mitigation: null })] }).find((c) => c.id === "rm-b")!;
    expect(open.status).toBe("partial");
    const closed = tcfdChecklist({ ...all, risks: [...all.risks, risk({ id: "x", mitigation: null, status: "closed" })] }).find((c) => c.id === "rm-b")!;
    expect(closed.status).toBe("met");
  });

  it("is partial on emissions without Scope 3, and a gap without published totals", () => {
    const ids = (totals: ClimateDisclosureView["totals"] | { periodLabel: string; scope3Tonnes: number } | null) =>
      tcfdChecklist({ ...all, totals: totals as never }).find((c) => c.id === "mt-b")!.status;
    expect(ids({ periodLabel: "FY2025", scope3Tonnes: 0 })).toBe("partial");
    expect(ids(null)).toBe("gap");
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
  it("falls back to an empty statement for malformed stored data", () => {
    expect(parseSections("nonsense").scenarios).toEqual([]);
    expect(parseSections({ scenarios: [{ name: "" }] }).governanceBoard).toBe("");
  });
});

describe("renderTcfdStatementHtml", () => {
  const view = (over: Partial<ClimateDisclosureView & { orgName: string }> = {}): ClimateDisclosureView & { orgName: string } => ({
    orgName: "Acme <Pty> Ltd",
    exists: true, status: "approved", approvalBody: "Board of directors", approvedAt: new Date("2026-02-01"), updatedAt: new Date(),
    sections: full(), risks: all.risks,
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

  it("maps each disclosure to its IFRS S2 area and formats for the organisation's country", () => {
    const html = renderTcfdStatementHtml(view({ format: { locale: "de-DE", currency: "EUR" } }));
    expect(html).toContain("Strategy: climate resilience, using scenario analysis");
    expect(html).toContain("115,0"); // the total with a decimal comma
  });

  it("escapes organisation text and keeps jurisdiction-neutral wording", () => {
    const html = renderTcfdStatementHtml(view());
    expect(html).toContain("Acme &lt;Pty&gt; Ltd");
    expect(html).toContain("depends on the organisation's jurisdiction");
  });
});
