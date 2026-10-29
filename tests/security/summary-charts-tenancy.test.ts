// @vitest-environment node
/**
 * The Summary analytics read one SQL statement keyed on the caller's organisation. This fails if the live
 * aggregate read or the reporting-period join drops its organisation filter, or if snapshot copies or
 * business-unit splits could be counted.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ $queryRaw: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: db }));

import { loadSummaryCharts } from "@/lib/dashboard/summary-charts";

beforeEach(() => {
  db.$queryRaw.mockReset();
  db.$queryRaw.mockResolvedValue([]);
});

describe("loadSummaryCharts tenancy", () => {
  it("filters dashboard aggregates and reporting periods by the organisation it was given", async () => {
    await loadSummaryCharts("org-b", "p-1", 1000);
    const [strings, ...values] = db.$queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    const sql = strings.join("?");
    const filters = [...sql.matchAll(/organization_id = \?/g)].length;
    expect(filters).toBe(2);
    expect(sql).toMatch(/FROM dashboard_aggregates\s+WHERE organization_id = \?/);
    expect(sql).toMatch(/JOIN reporting_periods p ON p\.id = l\.reporting_period_id AND p\.organization_id = \?/);
    expect(values.filter((v) => v === "org-b")).toHaveLength(2);
    expect(values).not.toContain("org-a");
  });

  it("counts live rows only, never a snapshot copy or a business-unit split", async () => {
    await loadSummaryCharts("org-b", "p-1", 1000);
    const [strings] = db.$queryRaw.mock.calls[0] as [TemplateStringsArray];
    const sql = strings.join("?");
    expect(sql).toContain("snapshot_id IS NULL");
    expect(sql).toContain("business_unit_id IS NULL");
    expect(sql).toMatch(/scope2_method IS NULL OR scope2_method = 'location_based'/);
  });
});
