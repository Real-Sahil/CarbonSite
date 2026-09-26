// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const model = () => ({ findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), aggregate: vi.fn(), groupBy: vi.fn() });
  return {
    publishedSnapshot: model(),
    dashboardAggregate: model(),
    emissionCalculation: model(),
    baseYear: model(),
    reductionTarget: model(),
    reductionInitiative: model(),
    assuranceEngagement: model(),
    contract: model(),
    socialValueRecord: model(),
    carbonBudget: model(),
    wasteRecord: model(),
  };
});
vi.mock("@/lib/db", () => ({ prisma: db }));
// No Carbon Reduction Plan, transition plan or carbon price in these fixtures.
vi.mock("@/lib/reports/commitments", () => ({
  loadOrgCommitments: vi.fn(async () => ({
    baseYear: null,
    netZeroYear: null,
    interimTargets: [],
    completedMeasures: [],
    plannedMeasures: [],
    signatory: null,
    efficiencyMeasures: [],
    carbonPrice: null,
  })),
}));

import {
  bidAnswers,
  bidPackReadiness,
  loadBidPackData,
  scopeTotalsFromRollup,
  summariseSocialValue,
  contractAnswer,
  type BidPackData,
} from "../carbon-pack";
import { renderBidCarbonPackHtml } from "@/lib/reports/templates/bid-carbon-pack";

const ORG = "org-a";
const period = { id: "p25", label: "FY2025", startDate: new Date("2025-01-01"), endDate: new Date("2025-12-31") };
const row = (scope: number, kg: number, scope2Method: string | null = null, snapshotId = "snap-25") => ({ snapshotId, scope, scope2Method, totalCo2e: kg });

function pack(over: Partial<BidPackData> = {}): BidPackData {
  return {
    orgName: "Acme Civils",
    bid: { title: "Highways framework", buyer: "Kent County Council", reference: "KCC-123" },
    snapshot: {
      id: "snap-25", version: 2, publishedAt: new Date("2026-02-01"), publishedBy: "Sam", periodLabel: "FY2025",
      periodStart: period.startDate, periodEnd: period.endDate, factorLibrary: "DEFRA 2025.2", methodology: "ghg-protocol-v2026-01",
      gwpVersion: "AR6", recordCount: 1200, reviewStatus: "approved",
    },
    current: { s1: 400, s2: 100, s2Market: 20, s3: 900, total: 1400 },
    categories: [{ code: "s1-mobile", name: "Mobile combustion", scope: 1, tonnes: 400 }],
    ppnScope3: [
      { code: "s3-upstream-transport", label: "Upstream (category 4)", tonnes: 50 },
      { code: "s3-waste", label: "Waste (category 5)", tonnes: 10 },
      { code: "s3-business-travel", label: "Travel (category 6)", tonnes: 5 },
      { code: "s3-commuting", label: "Commuting (category 7)", tonnes: 30 },
      { code: "s3-downstream-transport", label: "Downstream (category 9)", tonnes: 1 },
    ],
    history: [
      { periodLabel: "FY2024", periodEnd: new Date("2024-12-31"), snapshotVersion: 1, totals: { s1: 450, s2: 150, s2Market: null, s3: 950, total: 1550 } },
      { periodLabel: "FY2025", periodEnd: period.endDate, snapshotVersion: 2, totals: { s1: 400, s2: 100, s2Market: 20, s3: 900, total: 1400 } },
    ],
    baseYear: { label: "FY2019", s1: 600, s2: 400, s3: 1000, total: 2000 },
    targets: [{ type: "absolute", baselineLabel: "FY2019", targetLabel: "FY2030", reductionTonnes: 500, baselineTonnes: 2000 }],
    netZeroYear: 2045,
    interimTargets: [],
    initiatives: [
      { name: "HVO in plant", status: "complete", expectedTonnes: 120 },
      { name: "EV vans", status: "in_progress", expectedTonnes: null },
    ],
    assurance: { auditorSignOff: null, engagement: { provider: "Verify Ltd", standard: "iso_14064_3", level: "limited", status: "signed", opinionIssuedAt: new Date("2026-03-01") } },
    contracts: [{
      id: "c1", name: "A2 resurfacing", client: "National Highways", reference: "NH-9", value: 4_000_000, currency: "GBP",
      startDate: new Date("2024-04-01"), endDate: null, tonnes: 80, tonnesPerMillion: 20, budgetTonnes: 120,
      socialValuePounds: 250_000, wasteTonnes: 300, diversionRate: 0.94,
      ppn026: [{ id: "k1", title: "Training and retraining: Apprenticeship starts", target: 12, unit: "starts", delivered: 9, progressPct: 75, approvedEntries: 3, pendingEntries: 1, entriesWithEvidence: 3 }],
      socialValue: {
        targetPounds: 400_000,
        themes: [{ code: "NT1", name: "Jobs", pounds: 180_000 }, { code: "NT3", name: "Growth", pounds: 70_000 }],
        measures: [
          { code: "NT1", name: "Local employment", quantity: 4, unit: "FTE", pounds: 180_000 },
          { code: "NT18", name: "Spend with local SMEs", quantity: 70_000, unit: "£", pounds: 70_000 },
        ],
      },
    }],
    socialValuePounds: 400_000,
    signatory: { name: "Jo Bloggs", title: "Managing Director", date: "2026-03-10" },
    ...over,
  };
}

describe("scope totals from rollup rows", () => {
  it("reports market-based Scope 2 beside the headline, never in it", () => {
    const tot = scopeTotalsFromRollup([row(1, 1000), row(2, 500, "location_based"), row(2, 100, "market_based"), row(3, 2000)]);
    expect(tot).toEqual({ s1: 1, s2: 0.5, s2Market: 0.1, s3: 2, total: 3.5 });
  });
});

describe("readiness", () => {
  it("passes a complete pack", () => {
    expect(bidPackReadiness(pack()).filter((c) => !c.passed)).toEqual([]);
  });

  it("blocks a plan without a baseline, sign-off or a net zero year by 2050", () => {
    const failed = bidPackReadiness(pack({ baseYear: null, signatory: { name: null, title: null, date: null }, netZeroYear: 2060 }))
      .filter((c) => !c.passed && c.required)
      .map((c) => c.id);
    expect(failed).toEqual(["bid-base-year", "bid-net-zero", "bid-signatory"]);
  });

  it("warns, without blocking, on missing PPN Scope 3 categories", () => {
    const d = pack();
    d.ppnScope3[3].tonnes = null;
    const s3 = bidPackReadiness(d).find((c) => c.id === "bid-scope3")!;
    expect(s3).toMatchObject({ passed: false, required: false });
    expect(s3.message).toContain("Commuting");
  });
});

describe("model answers", () => {
  it("state only the pack's own figures", () => {
    const text = bidAnswers(pack()).map((a) => a.answer).join(" ");
    expect(text).toContain("1,400 tCO2e");
    expect(text).toContain("50.0% lower than our FY2019 base year"); // (400+100) vs (600+400)
    expect(text).toContain("net zero by 2045");
    expect(text).toContain("25.0% of the baseline");
    expect(text).toContain("94% of 300 t waste diverted");
    expect(text).toContain("Verify Ltd provided limited assurance under ISO 14064-3");
  });

  it("leave out what has no data rather than inventing it", () => {
    const answers = bidAnswers(pack({
      baseYear: null, history: [], initiatives: [], contracts: [], targets: [],
      assurance: { auditorSignOff: null, engagement: null },
    }));
    expect(answers.map((a) => a.question)).toEqual([
      "What is your organisation's carbon footprint?",
      "What are your carbon reduction targets and plans?",
    ]);
    expect(answers.map((a) => a.answer).join(" ")).not.toMatch(/base year|verified|NaN|undefined/);
  });
});

describe("social value per contract", () => {
  const rec = (code: string, theme: string, order: number, qty: number, pounds: number) => ({
    quantity: qty, valuePounds: pounds,
    measure: { tomsCode: code, name: `Measure ${code}`, unit: "FTE", theme: { code: theme, name: `Theme ${theme}`, sortOrder: order } },
  });

  it("sums delivery by theme in framework order and ranks measures by value", () => {
    const sv = summariseSocialValue(
      [rec("NT3", "T2", 2, 1, 10), rec("NT1", "T1", 1, 2, 50), rec("NT1", "T1", 1, 1, 25), rec("NT9", "T2", 2, 5, 40)],
      [{ targetPounds: 100 }, { targetPounds: 60 }],
    );
    expect(sv.targetPounds).toBe(160);
    expect(sv.themes).toEqual([{ code: "T1", name: "Theme T1", pounds: 75 }, { code: "T2", name: "Theme T2", pounds: 50 }]);
    expect(sv.measures.map((m) => [m.code, m.quantity, m.pounds])).toEqual([["NT1", 3, 75], ["NT9", 5, 40], ["NT3", 1, 10]]);
  });

  it("has no target when none was set, rather than a zero commitment", () => {
    expect(summariseSocialValue([], []).targetPounds).toBeNull();
  });

  it("answers for one contract with carbon, waste and TOMs side by side", () => {
    const text = contractAnswer(pack().contracts[0], "FY2025");
    expect(text).toContain("On A2 resurfacing for National Highways we recorded 80 tCO2e in FY2025");
    expect(text).toContain("20 tCO2e per £1m");
    expect(text).toContain("against a carbon budget of 120 tCO2e");
    expect(text).toContain("94% of 300 t of waste");
    expect(text).toContain("£250,000 of social value measured with the National TOMs against a commitment of £400,000 (63%)");
    expect(text).toContain("Local employment (NT1)");
    expect(text).not.toMatch(/undefined|NaN|null/);
  });

  it("states a commitment without delivery, and nothing about social value when neither exists", () => {
    const c = pack().contracts[0];
    const committed = contractAnswer({ ...c, socialValuePounds: 0, socialValue: { targetPounds: 50_000, themes: [], measures: [] } }, "FY2025");
    expect(committed).toContain("We have committed £50,000");
    const none = contractAnswer({ ...c, socialValuePounds: 0, socialValue: { targetPounds: null, themes: [], measures: [] } }, "FY2025");
    expect(none).not.toContain("social value");
  });

  it("adds a social value model answer only when a featured contract delivered some", () => {
    expect(bidAnswers(pack()).map((a) => a.question)).toContain("What social value have you delivered on comparable contracts?");
    const c = { ...pack().contracts[0], socialValuePounds: 0 };
    expect(bidAnswers(pack({ contracts: [c] })).map((a) => a.question)).not.toContain("What social value have you delivered on comparable contracts?");
  });
});

describe("pack document", () => {
  it("renders the CRP, evidence and sign-off without placeholders", () => {
    const html = renderBidCarbonPackHtml(pack());
    for (const s of ["Carbon Reduction Plan", "Declaration and sign-off", "Jo Bloggs", "A2 resurfacing", "Model answers", "KCC-123", "Social value committed (TOMs)", "63% of commitment", "Largest TOMs measures", "Answer for this contract", "PPN 026 KPIs (Good Jobs and Skills)", "Apprenticeship starts", "9 (75%)", "3 of 3"]) {
      expect(html).toContain(s);
    }
    expect(html).not.toMatch(/undefined|NaN|null/);
  });

  it("escapes user text and drops empty sections", () => {
    const html = renderBidCarbonPackHtml(pack({
      bid: { title: "<script>x</script>", buyer: null, reference: null },
      history: [], contracts: [], socialValuePounds: 0,
    }));
    expect(html).not.toContain("<script>x");
    expect(html).not.toContain("Emissions trend");
    expect(html).not.toContain("Contract delivery evidence");
    expect(html).not.toContain("Social value recorded");
  });
});

describe("loading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.publishedSnapshot.findFirst.mockResolvedValue({
      id: "snap-25", version: 2, reportingPeriodId: "p25", publishedAt: new Date("2026-02-01"), verificationStatus: "approved",
      organization: { name: "Acme Civils" }, reportingPeriod: period, publishedBy: { name: "Sam", email: "s@x" },
      calculationRun: { id: "run-25", factorLibrary: { name: "DEFRA", version: "2025.2" }, methodologyVersion: { name: "m", gwpVersion: "AR6" } },
      assurance: null,
    });
    db.dashboardAggregate.findMany.mockImplementation(({ where }: { where: { emissionCategoryId: unknown } }) =>
      Promise.resolve(where.emissionCategoryId === null ? [row(1, 1000), row(2, 500, "location_based")] : []),
    );
    db.emissionCalculation.count.mockResolvedValue(3);
    db.emissionCalculation.findMany.mockResolvedValue([]);
    db.publishedSnapshot.findMany.mockResolvedValue([]);
    db.baseYear.findFirst.mockResolvedValue(null);
    db.reductionTarget.findMany.mockResolvedValue([]);
    db.reductionInitiative.findMany.mockResolvedValue([]);
    db.assuranceEngagement.findFirst.mockResolvedValue(null);
    db.contract.findMany.mockResolvedValue([]);
    db.socialValueRecord.aggregate.mockResolvedValue({ _sum: { valuePounds: null } });
    db.socialValueRecord.groupBy.mockResolvedValue([]);
    db.carbonBudget.findMany.mockResolvedValue([]);
    db.wasteRecord.findMany.mockResolvedValue([]);
  });

  it("scopes every query to the organisation", async () => {
    const d = await loadBidPackData(ORG, "snap-25", { contractIds: ["c-other-org"] });
    expect(d.current).toMatchObject({ s1: 1, s2: 0.5, total: 1.5 });
    expect(d.contracts).toEqual([]);
    for (const m of Object.values(db)) {
      for (const fn of Object.values(m)) {
        for (const [args] of (fn as ReturnType<typeof vi.fn>).mock.calls) {
          expect(args.where.organizationId).toBe(ORG);
        }
      }
    }
  });

  it("refuses another organisation's snapshot", async () => {
    db.publishedSnapshot.findFirst.mockResolvedValue(null);
    await expect(loadBidPackData(ORG, "snap-b", {})).rejects.toMatchObject({ status: 404 });
  });
});
