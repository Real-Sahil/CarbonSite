import { describe, expect, it } from "vitest";
import { canGenerate, crpReadiness, parseSections, planTargets, type CrpContext, type CrpSections } from "../plan";
import { renderPpn006CrpHtml } from "@/lib/reports/templates/ppn-006-crp";

function ctx(over: Partial<CrpContext> = {}): CrpContext {
  return {
    period: { id: "p25", label: "FY2025", startDate: new Date("2025-01-01T00:00:00Z"), endDate: new Date("2025-12-31T00:00:00Z") },
    records: { total: 80, approved: 80, byScope: { 1: 30, 2: 20, 3: 30 } },
    latestRun: { id: "r2", status: "succeeded", finishedAt: new Date() },
    snapshot: {
      id: "s2",
      version: 1,
      publishedAt: new Date(),
      calculationRunId: "r2",
      reviewStatus: "approved",
      totals: { s1: 900, s2: 150, s2Market: null, s3: 3600, total: 4650 },
    },
    unpublishedRun: false,
    ppnScope3: [
      { code: "s3-upstream-transport", label: "Upstream transportation and distribution (category 4)", tonnes: 120 },
      { code: "s3-waste", label: "Waste generated in operations (category 5)", tonnes: 6 },
      { code: "s3-business-travel", label: "Business travel (category 6)", tonnes: 11 },
      { code: "s3-commuting", label: "Employee commuting (category 7)", tonnes: 41 },
      { code: "s3-downstream-transport", label: "Downstream transportation and distribution (category 9)", tonnes: null },
    ],
    baseYear: { id: "b1", label: "FY2024 base year", status: "active", periodLabel: "FY2024", endYear: 2024, s1: 1000, s2: 200, s3: 3900, total: 5100 },
    initiatives: [],
    runDefaults: { factorLibraryId: "lib", methodologyVersionId: "m" },
    ...over,
  };
}

function complete(): CrpSections {
  const s = parseSections({});
  return {
    ...s,
    organisation: {
      ...s.organisation,
      publicationUrl: "https://www.example.co.uk/crp",
      sitesIncluded: "Head office, Leeds depot and all UK sites.",
      exclusions: [{ id: "x", item: "Dormant subsidiary", reason: "No trading activity." }],
    },
    scope3: s.scope3.map((r) =>
      r.code === "s3-downstream-transport" ? { ...r, status: "not_relevant" as const, explanation: "We do not deliver goods to customers." } : r,
    ),
    baseline: { rationale: "First year with complete metered data.", additionalDetails: "" },
    targets: { ...s.targets, netZeroYear: 2045, interim: [{ id: "t", year: 2030, reductionPct: 50, scopes: "s1s2" as const }] },
    measures: { ...s.measures, completed: [{ id: "m", name: "HVO in site plant", year: 2025, description: "All excavators", savingTco2e: 120 }] },
    declaration: { signatoryName: "Sam Hartley", signatoryTitle: "Managing Director", signedDate: "2026-09-25", boardApproved: true, methodologyConfirmed: true },
  };
}

const failing = (s: CrpSections, c: CrpContext = ctx()) => crpReadiness(s, c).filter((x) => !x.passed).map((x) => x.id);

describe("parseSections", () => {
  it("fills every PPN Scope 3 category in PPN order and keeps saved answers", () => {
    const s = parseSections({ scope3: [{ code: "s3-commuting", status: "not_yet_measured", explanation: "Survey in 2026" }] });
    expect(s.scope3.map((r) => r.code)).toEqual(["s3-upstream-transport", "s3-waste", "s3-business-travel", "s3-commuting", "s3-downstream-transport"]);
    expect(s.scope3[3]).toEqual({ code: "s3-commuting", status: "not_yet_measured", explanation: "Survey in 2026" });
  });

  it("falls back to defaults for malformed stored JSON", () => {
    expect(parseSections({ targets: { netZeroYear: "soon" } }).targets.netZeroYear).toBe("");
    expect(parseSections(null).organisation.boundaryApproach).toBe("operational_control");
  });
});

describe("PPN 006 readiness", () => {
  it("passes a complete plan", () => {
    expect(failing(complete())).toEqual([]);
    expect(canGenerate(crpReadiness(complete(), ctx()))).toBe(true);
  });

  it("blocks a plan with no published figures or no Scope 1 and 2", () => {
    expect(failing(complete(), ctx({ snapshot: null }))).toEqual(expect.arrayContaining(["published", "scope12"]));
    expect(canGenerate(crpReadiness(complete(), ctx({ snapshot: null })))).toBe(false);
  });

  it("requires each missing Scope 3 category to be explained, not just marked", () => {
    const s = complete();
    s.scope3 = s.scope3.map((r) => (r.code === "s3-downstream-transport" ? { ...r, explanation: "" } : r));
    const check = crpReadiness(s, ctx()).find((c) => c.id === "scope3")!;
    expect(check.passed).toBe(false);
    expect(check.fix).toContain("category 9");
    s.scope3 = s.scope3.map((r) => (r.code === "s3-downstream-transport" ? { ...r, status: "reported" as const, explanation: "We will" } : r));
    expect(failing(s)).toContain("scope3");
  });

  it("rejects a net zero year after 2050 and interim targets that are not in the future", () => {
    const s = complete();
    s.targets.netZeroYear = 2055;
    s.targets.interim = [{ id: "t", year: 2025, reductionPct: 30, scopes: "s1s2" }];
    expect(failing(s)).toEqual(expect.arrayContaining(["net-zero", "interim"]));
  });

  it("needs a base year that is active, with a stated reason", () => {
    const s = complete();
    s.baseline.rationale = "";
    const c = ctx({ baseYear: { ...ctx().baseYear!, status: "draft" } });
    expect(failing(s, c)).toEqual(expect.arrayContaining(["base-year", "baseline-rationale"]));
  });

  it("needs a publication URL, a director with a date, and both confirmations", () => {
    const s = complete();
    s.organisation.publicationUrl = "our website";
    s.declaration = { ...s.declaration, signedDate: "25/09/2026", boardApproved: false, methodologyConfirmed: false };
    expect(failing(s)).toEqual(expect.arrayContaining(["publication", "signatory", "board", "method"]));
  });

  it("warns without blocking on stale publication, old baselines and SECR gaps", () => {
    const s = complete();
    s.secr = { include: true, intensityDenominator: "", intensityValue: "", efficiencyNarrative: "" };
    const c = ctx({ unpublishedRun: true, baseYear: { ...ctx().baseYear!, endYear: 2017 } });
    const checks = crpReadiness(s, c);
    expect(checks.filter((x) => !x.passed).map((x) => x.id)).toEqual(expect.arrayContaining(["current-run", "baseline-recent", "secr"]));
    expect(canGenerate(checks)).toBe(true);
  });
});

describe("plan targets", () => {
  it("prints complete interim targets in year order with their scope coverage", () => {
    const s = complete();
    s.targets.interim = [
      { id: "b", year: 2035, reductionPct: 75, scopes: "s1s2s3" },
      { id: "a", year: 2030, reductionPct: 50, scopes: "s1s2" },
      { id: "c", year: "", reductionPct: 10, scopes: "s1s2" },
    ];
    expect(planTargets(s)).toEqual([
      { year: 2030, reductionPct: 50, description: "Scopes 1 and 2" },
      { year: 2035, reductionPct: 75, description: "Scopes 1, 2 and 3" },
    ]);
  });
});

describe("PPN 006 document with a guided plan", () => {
  it("prints the supplier, baseline rationale, Scope 3 notes, projects and declaration", () => {
    const html = renderPpn006CrpHtml({
      orgName: "Northgate Civils Ltd",
      periodLabel: "FY2025",
      baselineYear: 2024,
      reportingYear: 2025,
      factorLibrary: "DEFRA 2025.2",
      methodology: "ghg-protocol-v2026-02",
      gwpVersion: "AR6",
      scope1Kg: 900_000,
      scope2Kg: 150_000,
      scope3Kg: 3_600_000,
      scopeRows: [],
      targets: [{ year: 2030, reductionPct: 50, description: "Scopes 1 and 2" }],
      netZeroYear: 2045,
      signatoryName: "Sam Hartley",
      signatoryTitle: "Managing Director",
      signatoryDate: "25 September 2026",
      plan: {
        companyNumber: "01234567",
        publicationUrl: "https://www.example.co.uk/crp",
        description: "Civils contractor in Yorkshire.",
        boundaryApproach: "Operational control",
        sitesIncluded: "All UK sites.",
        exclusions: [{ item: "Dormant subsidiary", reason: "No trading activity." }],
        baselineRationale: "First year with complete metered data.",
        baselineDetails: "",
        scope3: [{ label: "Downstream transportation and distribution (category 9)", tonnes: null, status: "not_relevant", explanation: "No deliveries to customers." }],
        sbtiValidated: false,
        trajectoryNote: "",
        completed: [{ name: "HVO in site plant", year: "2025", description: "All excavators", savingTco2e: "120" }],
        planned: [],
        futureNote: "",
        boardApproved: true,
      },
    });
    for (const text of [
      "Supplier and scope of this plan",
      "01234567",
      "https://www.example.co.uk/crp",
      "Dormant subsidiary",
      "First year with complete metered data.",
      "Not relevant",
      "No deliveries to customers.",
      "HVO in site plant",
      "120 tCO2e",
      "No planned measures recorded.",
      "signed off by the board of directors",
      "DEFRA 2025.2",
    ]) {
      expect(html).toContain(text);
    }
    expect(html).not.toMatch(/undefined|NaN/);
  });

  it("escapes plan text", () => {
    const html = renderPpn006CrpHtml({
      orgName: "X",
      periodLabel: "FY2025",
      reportingYear: 2025,
      factorLibrary: "L",
      methodology: "M",
      gwpVersion: "AR6",
      scope1Kg: 1,
      scope2Kg: 1,
      scope3Kg: 0,
      scopeRows: [],
      targets: [],
      plan: {
        companyNumber: "",
        publicationUrl: "https://x.test",
        description: "<script>alert(1)</script>",
        boundaryApproach: "Operational control",
        sitesIncluded: "a\nb",
        exclusions: [],
        baselineRationale: "",
        baselineDetails: "",
        scope3: [],
        sbtiValidated: false,
        trajectoryNote: "",
        completed: [],
        planned: [],
        futureNote: "",
        boardApproved: false,
      },
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("a<br />b");
  });
});
