import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { getLimits, hasFeature, minimumPlanFor, PLAN_ANNUAL_TOTAL, reportTypeAllowed } from "../limits";

describe("Essentials plan", () => {
  it("is £199 a year for one site, two web users and no frameworks", () => {
    expect(PLAN_ANNUAL_TOTAL.essentials).toBe(199);
    expect(getLimits("essentials")).toMatchObject({ facilities: 1, members: 2, frameworks: 0 });
  });

  it("generates only the Carbon Reduction Plan and GHG Protocol reports", () => {
    expect(reportTypeAllowed("essentials", "ppn_006_crp")).toBe(true);
    expect(reportTypeAllowed("essentials", "ghg_protocol")).toBe(true);
    expect(reportTypeAllowed("essentials", "secr")).toBe(false);
    expect(reportTypeAllowed("essentials", "bid_carbon_pack")).toBe(false);
    for (const plan of ["trial", "starter", "growth", "enterprise"]) expect(reportTypeAllowed(plan, "secr")).toBe(true);
  });

  it("has none of the paid feature gates", () => {
    for (const f of ["socialValue", "bidCarbonPack", "pas2080", "accountingIntegrations"] as const) {
      expect(hasFeature("essentials", f)).toBe(false);
    }
  });
});

describe("minimumPlanFor", () => {
  it("names the cheapest paid plan, never the trial", () => {
    expect(minimumPlanFor("socialValue")).toBe("growth");
    expect(minimumPlanFor("allReportTypes")).toBe("starter");
    expect(minimumPlanFor("sso")).toBe("enterprise");
  });
});
