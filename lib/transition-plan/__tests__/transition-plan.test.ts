// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { buildPathway, gapAt, referenceTco2e, transitionChecklist, type Lever, type PlanFields } from "../index";

const db = vi.hoisted(() => ({
  transitionPlan: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
  reductionInitiative: { count: vi.fn(), findMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
const requireOrgMember = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/session")>()),
  requireOrgMember,
}));

const lever = (over: Partial<Lever>): Lever => ({ id: "l", name: "LED", status: "planned", abatementTco2e: 10, startYear: 2026, capex: null, ...over });

describe("pathway", () => {
  it("draws the 1.5°C benchmark at 4.2% of the base a year, floored at a 90% cut", () => {
    expect(referenceTco2e(1000, 2020, 2020)).toBe(1000);
    expect(referenceTco2e(1000, 2020, 2030)).toBeCloseTo(580, 6);
    expect(referenceTco2e(1000, 2020, 2050)).toBeCloseTo(100, 6);
  });

  it("plans only scheduled, uncancelled levers from the year they start", () => {
    const points = buildPathway({
      baseYear: 2024,
      baseTco2e: 100,
      endYear: 2030,
      actualByYear: new Map([[2025, 95]]),
      levers: [
        lever({ id: "a", abatementTco2e: 20, startYear: 2026 }),
        lever({ id: "b", abatementTco2e: 30, startYear: 2028 }),
        lever({ id: "c", abatementTco2e: 50, startYear: null }),
        lever({ id: "d", abatementTco2e: 50, startYear: 2025, status: "canceled" }),
      ],
    });
    expect(points.map((p) => p.planned)).toEqual([100, 100, 80, 80, 50, 50, 50]);
    expect(points[1].actual).toBe(95);
    expect(points[0].target).toBeNull();
    const gap = gapAt(points, 2030)!;
    expect(gap.against).toBe("reference");
    expect(gap.goal).toBeCloseTo(100 * (1 - 0.042 * 6), 6);
    expect(gap.gapTco2e).toBeCloseTo(50 - gap.goal, 6);
  });
});

const fullPlan: PlanFields = {
  status: "approved",
  ambition: "Net zero across our value chain by 2045, halving scope 1 and 2 by 2030.",
  netZeroYear: 2045,
  strategy: "Carbon is a gate in every capital approval and each budget line carries its emissions.",
  engagement: "Top 50 suppliers set targets by 2027; we sit on the industry low-carbon concrete group.",
  governance: "The board reviews progress every quarter; the COO owns delivery and it is in the bonus scorecard.",
  lockedInEmissions: "Diesel plant bought before 2025 runs to 2032; replacements are electric or HVO only.",
  capexPlanned: 2_000_000,
  opexPlanned: null,
  taxonomyAlignedCapexPct: null,
  approvalBody: "Board of directors",
  approvedAt: new Date("2026-06-30"),
};

describe("E1-1 checklist", () => {
  const target = { baseYear: 2020, nearTermYear: 2030, nearTermReductionPct: 46.2, netZeroYear: 2050, coversScope3: true };

  it("is complete for an approved plan with a 1.5°C target and funded, scheduled levers", () => {
    const checks = transitionChecklist({
      plan: fullPlan,
      target,
      levers: [lever({})],
      nearTermGap: { year: 2030, planned: 50, goal: 58, gapTco2e: -8, against: "target" },
      latestActual: { year: 2025, actual: 80, expected: 80 },
    });
    expect(checks.filter((c) => c.id !== "taxonomy").every((c) => c.status === "met")).toBe(true);
  });

  it("says what is missing: weak target, unscheduled levers, gap, no approval", () => {
    const checks = transitionChecklist({
      plan: { ...fullPlan, status: "draft", approvedAt: null, lockedInEmissions: null },
      target: { ...target, nearTermReductionPct: 25 },
      levers: [lever({ startYear: null }), lever({ id: "b", abatementTco2e: null })],
      nearTermGap: { year: 2030, planned: 90, goal: 58, gapTco2e: 32, against: "target" },
      latestActual: { year: 2025, actual: 100, expected: 80 },
    });
    const byId = Object.fromEntries(checks.map((c) => [c.id, c]));
    expect(byId.targets.status).toBe("partial");
    expect(byId.targets.detail).toMatch(/2.5% of base-year emissions a year/);
    expect(byId.levers.status).toBe("partial");
    expect(byId.schedule.status).toBe("partial");
    expect(byId.gap.detail).toMatch(/32 tCO2e a year still to find by 2030/);
    expect(byId["locked-in"].status).toBe("gap");
    expect(byId.governance.status).toBe("gap");
    expect(byId.progress.status).toBe("partial");
  });
});

describe("transition plan routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an approved plan to draft when it is edited, in the caller's organisation", async () => {
    requireOrgMember.mockResolvedValue({ session: { user: { id: "u1" } }, membership: { role: "editor" } });
    const { PUT } = await import("@/app/api/orgs/[orgId]/transition-plan/route");
    db.transitionPlan.findUnique.mockResolvedValue({ id: "tp1", status: "approved" });
    db.transitionPlan.upsert.mockResolvedValue({ id: "tp1" });
    const res = await PUT(
      new NextRequest("http://localhost/x", { method: "PUT", body: JSON.stringify({ organizationId: "org-b", ambition: "Net zero by 2045" }) }),
      { params: Promise.resolve({ orgId: "org-a" }) },
    );
    expect(res.status).toBe(200);
    const call = db.transitionPlan.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ organizationId: "org-a" });
    expect(call.create.organizationId).toBe("org-a");
    expect(call.update).toMatchObject({ status: "draft", approvedAt: null, approvedByUserId: null });
    expect(call.update.organizationId).toBeUndefined();
  });

  it("only lets an admin record approval, and not for a future date", async () => {
    const { POST } = await import("@/app/api/orgs/[orgId]/transition-plan/approve/route");
    const { ROLE_GROUPS } = await import("@/lib/auth/session");
    requireOrgMember.mockResolvedValue({ session: { user: { id: "u1" } }, membership: { role: "admin" } });
    db.transitionPlan.findUnique.mockResolvedValue({ id: "tp1" });

    const future = await POST(
      new NextRequest("http://localhost/x", { method: "POST", body: JSON.stringify({ approvalBody: "Board", approvedOn: "2999-01-01" }) }),
      { params: Promise.resolve({ orgId: "org-a" }) },
    );
    expect(future.status).toBe(400);
    expect(requireOrgMember).toHaveBeenCalledWith("org-a", ...ROLE_GROUPS.admins);

    db.transitionPlan.update.mockResolvedValue({ id: "tp1" });
    const ok = await POST(
      new NextRequest("http://localhost/x", { method: "POST", body: JSON.stringify({ approvalBody: "Board", approvedOn: "2026-06-30" }) }),
      { params: Promise.resolve({ orgId: "org-a" }) },
    );
    expect(ok.status).toBe(200);
    expect(db.transitionPlan.findUnique.mock.calls.at(-1)![0].where).toEqual({ organizationId: "org-a" });
    expect(db.transitionPlan.update.mock.calls[0][0].data).toMatchObject({ status: "approved", approvalBody: "Board" });
  });
});

describe("E1-1 resolver", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not call initiatives alone a transition plan", async () => {
    const { runResolver } = await import("@/lib/compliance/datapoint-resolvers");
    db.transitionPlan.findUnique.mockResolvedValue(null);
    db.reductionInitiative.count.mockResolvedValue(4);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await runResolver("transition_plan_disclosed", "org-a", db as any);
    expect(r?.status).toBe("partial");
    expect(db.transitionPlan.findUnique.mock.calls[0][0].where).toEqual({ organizationId: "org-a" });
  });
});
