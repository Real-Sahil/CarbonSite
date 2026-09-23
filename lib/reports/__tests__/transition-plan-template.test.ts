// @vitest-environment node
import { describe, expect, it } from "vitest";
import { pathwaySvg, renderTransitionPlanHtml, type TransitionPlanReportData } from "../templates/transition-plan";
import { buildPathway, transitionChecklist } from "@/lib/transition-plan";

const points = buildPathway({
  baseYear: 2020,
  baseTco2e: 1000,
  endYear: 2030,
  targetForYear: (y) => 1000 - (y - 2020) * 46.2,
  actualByYear: new Map([[2024, 850]]),
  levers: [{ id: "a", name: "Heat pumps <depot>", status: "planned", abatementTco2e: 200, startYear: 2026, capex: 50_000 }],
});

const base = (over: Partial<TransitionPlanReportData> = {}): TransitionPlanReportData => ({
  plan: null,
  approvedByUserId: null,
  currency: "GBP",
  base: { year: 2020, tco2e: 1000, source: "SBTi target baseline" },
  target: null,
  levers: [{ id: "a", name: "Heat pumps <depot>", status: "planned", abatementTco2e: 200, startYear: 2026, capex: 50_000 }],
  points,
  nearTermGap: { year: 2030, planned: 800, goal: 538, gapTco2e: 262, against: "target" },
  checklist: transitionChecklist({ plan: null, target: null, levers: [], nearTermGap: null, latestActual: null }),
  unscheduled: [],
  orgName: "Acme & Sons",
  snapshot: { version: 3, periodLabel: "FY2025", publishedAt: new Date("2026-04-01") },
  ...over,
});

describe("transition plan report", () => {
  it("marks an unapproved plan as a draft and never fills blank narrative", () => {
    const html = renderTransitionPlanHtml(base());
    expect(html).toContain("Draft, not yet approved");
    expect(html).toContain("Not yet recorded in the plan.");
    expect(html).toContain("262 tCO₂e a year still to find by 2030");
    expect(html).toContain("Acme &amp; Sons");
    expect(html).toContain("Heat pumps &lt;depot&gt;");
    expect(html).not.toContain("<depot>");
  });

  it("states the approval body and date once approved", () => {
    const html = renderTransitionPlanHtml(
      base({
        plan: {
          status: "approved", ambition: "Net zero by 2045.\n\nHalve Scope 1 and 2 by 2030.", netZeroYear: 2045, strategy: null, engagement: null,
          governance: null, lockedInEmissions: null, capexPlanned: 2_000_000, opexPlanned: null, taxonomyAlignedCapexPct: null,
          approvalBody: "Board of directors", approvedAt: new Date("2026-06-30T00:00:00Z"),
        },
      }),
    );
    expect(html).toContain("Approved by Board of directors on 30 June 2026");
    expect(html).not.toContain("Draft, not yet approved");
    expect(html).toContain("<p>Halve Scope 1 and 2 by 2030.</p>");
    expect(html).toContain("£2,000,000");
  });

  it("draws every line on one scale", () => {
    const svg = pathwaySvg(points);
    expect(svg.match(/<polyline/g)).toHaveLength(3);
    expect(svg.match(/<circle/g)).toHaveLength(1);
    expect(pathwaySvg(points.slice(0, 1))).toBe("");
  });
});
