// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeBurndown, escalates } from "../burndown";
import type { EvmResult } from "../evm";

const db = vi.hoisted(() => ({
  carbonBudget: { findMany: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
  organizationMembership: { findMany: vi.fn() },
  project: { findFirst: vi.fn() },
  $queryRaw: vi.fn(),
}));
const dispatchNotification = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/jobs/dispatch", () => ({ dispatchNotification }));

const start = new Date("2026-01-01");
const end = new Date("2026-12-31");
const asOf = new Date("2026-06-15");

describe("computeBurndown", () => {
  it("forecasts from the three-month run rate to the end date", () => {
    const b = computeBurndown({
      budgetTco2e: 120,
      start,
      end,
      asOf,
      monthly: [
        { month: "2026-01", tco2e: 5 },
        { month: "2026-04", tco2e: 10 },
        { month: "2026-05", tco2e: 10 },
        { month: "2026-06", tco2e: 10 },
      ],
    });
    expect(b.actualToDate).toBe(35);
    expect(b.runRatePerMonth).toBe(10);
    expect(b.method).toBe("run_rate");
    // Six months left (Jul-Dec) at 10 a month.
    expect(b.forecastAtCompletion).toBe(95);
    expect(b.status).toBe("on_track");
    expect(b.points).toHaveLength(12);
    expect(b.points.at(-1)?.forecastCumulative).toBeCloseTo(95, 6);
    expect(b.points.find((p) => p.month === "2026-06")?.cumulativeActual).toBe(35);
    expect(b.points.find((p) => p.month === "2026-07")?.cumulativeActual).toBeNull();
  });

  it("flags a forecast over budget, and one close to it as at risk", () => {
    const monthly = [{ month: "2026-06", tco2e: 20 }];
    const over = computeBurndown({ budgetTco2e: 65, start, end, asOf, monthly });
    expect(over.forecastAtCompletion).toBeCloseTo(20 + (20 / 3) * 6, 6);
    expect(over.status).toBe("at_risk");
    expect(computeBurndown({ budgetTco2e: 50, start, end, asOf, monthly }).status).toBe("over");
    expect(computeBurndown({ budgetTco2e: 10, start, end, asOf, monthly }).reasons[0]).toMatch(/already exceeds/);
  });

  it("prefers the earned value forecast once the trend is meaningful", () => {
    const evm = { method: "cpi_trend", forecastAtCompletionTco2e: 150 } as EvmResult;
    const b = computeBurndown({ budgetTco2e: 120, start, end, asOf, monthly: [{ month: "2026-02", tco2e: 30 }], evm });
    expect(b.method).toBe("evm");
    expect(b.status).toBe("over");
    const early = computeBurndown({ budgetTco2e: 120, start, end, asOf, monthly: [{ month: "2026-02", tco2e: 30 }], evm: { ...evm, method: "linear_no_trend" } });
    expect(early.method).toBe("run_rate");
  });

  it("warns when carbon is burning well ahead of the planned spend", () => {
    const b = computeBurndown({ budgetTco2e: 1000, start, end, asOf, monthly: [{ month: "2026-01", tco2e: 600 }] });
    expect(b.plannedToDate).toBeGreaterThan(400);
    expect(b.status).toBe("at_risk");
    expect(b.reasons.some((r) => r.includes("ahead of the planned spend"))).toBe(true);
  });

  it("does not forecast without an end date", () => {
    const b = computeBurndown({ budgetTco2e: 100, start: null, end: null, asOf, monthly: [{ month: "2026-05", tco2e: 5 }] });
    expect(b.method).toBe("none");
    expect(b.forecastAtCompletion).toBeNull();
    expect(b.plannedToDate).toBeNull();
    expect(b.status).toBe("on_track");
  });

  it("only escalates when the status gets worse", () => {
    expect(escalates(null, "at_risk")).toBe(true);
    expect(escalates("at_risk", "at_risk")).toBe(false);
    expect(escalates("at_risk", "over")).toBe(true);
    expect(escalates("over", "at_risk")).toBe(false);
  });
});

describe("processCarbonBudgetAlerts", () => {
  beforeEach(() => vi.clearAllMocks());

  const budgetRow = (forecastAlertLevel: string | null) => ({
    id: "b1", organizationId: "org-a", projectId: "p1", forecastAlertLevel, project: { name: "Depot", contractId: "c1" },
  });

  function mockProject(budget: number, kgInJune: number) {
    db.project.findFirst.mockResolvedValue({ startDate: start, endDate: end });
    db.carbonBudget.findFirst.mockResolvedValue({ totalBudgetTco2e: budget, phases: [] });
    db.$queryRaw.mockResolvedValueOnce([{ month: "2026-06", kg: kgInJune }]).mockResolvedValueOnce([]);
  }

  it("notifies the organisation's own members once when a forecast goes over, scoped by org", async () => {
    const { processCarbonBudgetAlerts } = await import("../burndown-alerts");
    db.carbonBudget.findMany.mockResolvedValue([budgetRow(null)]);
    mockProject(50, 20_000);
    db.organizationMembership.findMany.mockResolvedValue([{ userId: "u1" }, { userId: "u2" }]);

    const r = await processCarbonBudgetAlerts(asOf);
    expect(r.alerted).toBe(1);
    expect(db.project.findFirst.mock.calls[0][0].where).toMatchObject({ id: "p1", organizationId: "org-a" });
    expect(db.carbonBudget.findFirst.mock.calls[0][0].where).toMatchObject({ projectId: "p1", organizationId: "org-a" });
    expect(db.organizationMembership.findMany.mock.calls[0][0].where.organizationId).toBe("org-a");
    expect(dispatchNotification).toHaveBeenCalledTimes(2);
    expect(dispatchNotification.mock.calls[0][0]).toMatchObject({ type: "carbon_budget_forecast", orgId: "org-a", metadata: { status: "over" } });
    expect(db.carbonBudget.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ forecastAlertLevel: "over" }) }));
  });

  it("stays quiet when the level was already alerted, and resets when the budget recovers", async () => {
    const { processCarbonBudgetAlerts } = await import("../burndown-alerts");
    db.carbonBudget.findMany.mockResolvedValue([budgetRow("over")]);
    mockProject(50, 20_000);
    expect((await processCarbonBudgetAlerts(asOf)).alerted).toBe(0);
    expect(dispatchNotification).not.toHaveBeenCalled();

    mockProject(10_000, 1_000);
    await processCarbonBudgetAlerts(asOf);
    expect(db.carbonBudget.update).toHaveBeenCalledWith({ where: { id: "b1" }, data: { forecastAlertLevel: null } });
  });
});
