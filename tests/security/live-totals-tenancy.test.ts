// @vitest-environment node
/** Live totals read only the caller's organisation: every query is scoped and org B never sees org A's kg. */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Where = Record<string, unknown>;

const rows = vi.hoisted(() => ({
  periods: [
    { id: "p-a", organizationId: "org-a" },
    { id: "p-b", organizationId: "org-b" },
  ],
  runs: [
    { id: "r-a", organizationId: "org-a", reportingPeriodId: "p-a", status: "succeeded", finishedAt: new Date(0), createdAt: new Date(0) },
    { id: "r-b", organizationId: "org-b", reportingPeriodId: "p-b", status: "succeeded", finishedAt: new Date(0), createdAt: new Date(0) },
  ],
  aggregates: [
    { organizationId: "org-a", reportingPeriodId: "p-a", snapshotId: null, scope: 1, totalKg: 1000 },
    { organizationId: "org-b", reportingPeriodId: "p-b", snapshotId: null, scope: 1, totalKg: 7 },
  ],
}));

const wheres = vi.hoisted(() => [] as Where[]);

const db = vi.hoisted(() => ({
  reportingPeriod: { findFirst: vi.fn() },
  calculationRun: { findFirst: vi.fn() },
  dashboardAggregate: { groupBy: vi.fn(), findMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: db }));

import { loadLiveTotals } from "@/lib/realtime/live-totals";

const matches = (row: Where, where: Where) =>
  Object.entries(where).every(([k, v]) => typeof v !== "string" && v !== null ? true : row[k] === v);
const pick = (list: Where[]) => async ({ where }: { where: Where }) => {
  wheres.push(where);
  return list.find((r) => matches(r, where)) ?? null;
};
const pickAll = (list: Where[]) => async ({ where }: { where: Where }) => {
  wheres.push(where);
  return list.filter((r) => matches(r, where));
};

beforeEach(() => {
  vi.clearAllMocks();
  wheres.length = 0;
  db.reportingPeriod.findFirst.mockImplementation(pick(rows.periods));
  db.calculationRun.findFirst.mockImplementation(pick(rows.runs));
  db.dashboardAggregate.findMany.mockImplementation(pickAll(rows.aggregates));
  db.dashboardAggregate.groupBy.mockImplementation(async ({ where }: { where: Where }) => {
    wheres.push(where);
    return [];
  });
});

describe("loadLiveTotals tenancy", () => {
  it("scopes every query to the caller's organisation", async () => {
    await loadLiveTotals("org-b");
    expect(wheres.length).toBeGreaterThan(0);
    for (const w of wheres) expect(w.organizationId).toBe("org-b");
  });

  it("never returns another organisation's aggregates", async () => {
    await loadLiveTotals("org-b");
    const returned = await Promise.all(db.dashboardAggregate.findMany.mock.results.map((r) => r.value));
    for (const list of returned) {
      for (const r of list as Where[]) expect(r.organizationId).toBe("org-b");
    }
  });
});
