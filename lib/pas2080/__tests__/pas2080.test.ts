// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { opportunityProblem, pas2080Checks, pas2080Position, type OpportunityInput, type PlanInput } from "../index";

const db = vi.hoisted(() => {
  const model = () => ({ findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn(), delete: vi.fn(), aggregate: vi.fn() });
  return { project: model(), carbonManagementPlan: model(), carbonReductionOpportunity: model(), embodiedCarbonRecord: model(), $queryRaw: vi.fn() };
});
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/session")>();
  return {
    ...actual,
    requireOrgMember: vi.fn().mockResolvedValue({ session: { user: { id: "u-a" } }, membership: { role: "admin" } }),
  };
});

const plan: PlanInput = {
  valueChainRole: "constructor",
  carbonLeadName: "Sam Lead",
  baselineTco2e: 1000,
  baselineBasis: "Stage 2 reference design",
  targetTco2e: 700,
  modulesInScope: ["A1-A3", "A4", "A5"],
};
const opp = (o: Partial<OpportunityInput>): OpportunityInput => ({
  hierarchyLevel: "build_clever", status: "identified", estimatedSavingTco2e: null, decisionRationale: null, ...o,
});

describe("position", () => {
  it("forecasts from committed savings only, and splits them by hierarchy level", () => {
    const p = pas2080Position(plan, [
      opp({ hierarchyLevel: "build_less", status: "adopted", estimatedSavingTco2e: 200 }),
      opp({ hierarchyLevel: "build_clever", status: "implemented", estimatedSavingTco2e: 150 }),
      opp({ hierarchyLevel: "build_clever", status: "under_review", estimatedSavingTco2e: 80 }),
      opp({ hierarchyLevel: "build_nothing", status: "rejected", estimatedSavingTco2e: 900, decisionRationale: "Statutory duty to provide the crossing" }),
    ], 120);
    expect(p).toMatchObject({ committedSavings: 350, pipelineSavings: 80, forecast: 650, gapToTarget: -50, measured: 120 });
    expect(p.byLevel.map((l) => [l.level, l.committed, l.pipeline, l.rejected])).toEqual([
      ["build_nothing", 0, 0, 1],
      ["build_less", 200, 0, 0],
      ["build_clever", 150, 80, 0],
      ["build_efficiently", 0, 0, 0],
    ]);
  });

  it("has no forecast without a baseline", () => {
    expect(pas2080Position(null, [], 0)).toMatchObject({ baseline: null, forecast: null, gapToTarget: null });
  });
});

describe("checks", () => {
  it("pass a complete plan that considered building less", () => {
    const opps = [opp({ hierarchyLevel: "build_less", status: "adopted", estimatedSavingTco2e: 400 })];
    const checks = pas2080Checks(plan, opps, pas2080Position(plan, opps, 50));
    expect(checks.filter((c) => !c.passed)).toEqual([]);
  });

  it("block a plan with no lead, boundary or higher-hierarchy options, and unexplained rejections", () => {
    const weak: PlanInput = { ...plan, carbonLeadName: null, modulesInScope: [], targetTco2e: 1200 };
    const opps = [opp({ status: "rejected" })];
    const failed = pas2080Checks(weak, opps, pas2080Position(weak, opps, 0)).filter((c) => !c.passed && c.required).map((c) => c.id);
    expect(failed).toEqual(["lead", "boundary", "target", "hierarchy", "decisions"]);
  });

  it("require a reason for every rejection", () => {
    expect(opportunityProblem({ status: "rejected", decisionRationale: " " })).toMatch(/why/);
    expect(opportunityProblem({ status: "rejected", decisionRationale: "Too costly" })).toBeNull();
    expect(opportunityProblem({ status: "adopted" })).toBeNull();
  });
});

const params = (projectId = "proj-a", opportunityId?: string) => ({
  params: Promise.resolve({ orgId: "org-a", contractId: "c-a", projectId, ...(opportunityId ? { opportunityId } : {}) }),
});
const req = (method: string, body: unknown) =>
  new NextRequest("http://localhost/x", { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } });

describe("API tenant isolation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("will not write a plan on another organisation's project", async () => {
    const { PUT } = await import("@/app/api/orgs/[orgId]/contracts/[contractId]/projects/[projectId]/pas2080/route");
    db.project.findFirst.mockResolvedValue(null);
    const res = await PUT(req("PUT", { valueChainRole: "constructor" }), params("proj-b"));
    expect(res.status).toBe(404);
    expect(db.project.findFirst.mock.calls[0][0].where).toEqual({ id: "proj-b", contractId: "c-a", organizationId: "org-a" });
    expect(db.carbonManagementPlan.upsert).not.toHaveBeenCalled();
  });

  it("will not change another organisation's opportunity", async () => {
    const { PATCH } = await import("@/app/api/orgs/[orgId]/contracts/[contractId]/projects/[projectId]/pas2080/opportunities/[opportunityId]/route");
    db.carbonReductionOpportunity.findFirst.mockResolvedValue(null);
    const res = await PATCH(req("PATCH", { status: "adopted" }), params("proj-a", "opp-b"));
    expect(res.status).toBe(404);
    expect(db.carbonReductionOpportunity.findFirst.mock.calls[0][0].where).toMatchObject({ id: "opp-b", organizationId: "org-a", projectId: "proj-a" });
    expect(db.carbonReductionOpportunity.update).not.toHaveBeenCalled();
  });

  it("refuses a rejection without a reason, and keeps decided entries on the log", async () => {
    const { PATCH, DELETE } = await import("@/app/api/orgs/[orgId]/contracts/[contractId]/projects/[projectId]/pas2080/opportunities/[opportunityId]/route");
    db.carbonReductionOpportunity.findFirst.mockResolvedValue({ id: "opp-a", status: "adopted", decisionRationale: null, title: "x" });
    expect((await PATCH(req("PATCH", { status: "rejected" }), params("proj-a", "opp-a"))).status).toBe(422);
    expect((await DELETE(req("DELETE", {}), params("proj-a", "opp-a"))).status).toBe(409);
    expect(db.carbonReductionOpportunity.delete).not.toHaveBeenCalled();
  });

  it("rejects a target that is not below the baseline", async () => {
    const { PUT } = await import("@/app/api/orgs/[orgId]/contracts/[contractId]/projects/[projectId]/pas2080/route");
    db.project.findFirst.mockResolvedValue({ id: "proj-a" });
    const res = await PUT(req("PUT", { valueChainRole: "designer", baselineTco2e: 100, targetTco2e: 120 }), params());
    expect(res.status).toBe(422);
  });
});
