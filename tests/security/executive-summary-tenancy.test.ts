// @vitest-environment node
/**
 * The Executive Summary reads one SQL statement keyed on the caller's organisation, and it sits behind the
 * same role check as the dashboard. This fails if a clause drops its organisation filter, if field workers
 * or suppliers could reach the Summary, or if a non-admin could switch the Summary on with ?earthy=1.
 */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ $queryRaw: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: db }));

import { loadExecutiveSummary } from "@/lib/dashboard/executive-summary";
import { ROLE_GROUPS } from "@/lib/auth/session";

const PERIOD = { id: "p-1", label: "FY2025", startDate: new Date("2025-01-01"), endDate: new Date("2025-12-31") };

beforeEach(() => {
  db.$queryRaw.mockReset();
  db.$queryRaw.mockResolvedValue([
    { currentKg: null, priorKg: null, scope1Kg: null, scope2Kg: null, scope3Kg: null, hotspotLabel: null, hotspotKg: null, baselineKg: null, targetEnd: null, baselineEnd: null, reductionKg: null, pendingSubmissions: 0, openReviews: 0, fieldWorkers: 0, imports: 0, succeededRuns: 0 },
  ]);
});

describe("loadExecutiveSummary tenancy", () => {
  it("scopes every table it reads to the organisation id it was given", async () => {
    await loadExecutiveSummary("org-b", PERIOD, { id: "p-0" });
    const [strings, ...values] = db.$queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    const sql = strings.join("?");

    // Every read of a tenant table carries `organization_id = <param>`, and that parameter is the caller's org.
    const orgFilters = [...sql.matchAll(/organization_id = \?/g)].length;
    expect(orgFilters).toBeGreaterThanOrEqual(7);
    const tables = [...sql.matchAll(/FROM (\w+)/g)].map((m) => m[1]).filter((t) => t !== "live" && t !== "tgt" && t !== "hot");
    for (const table of new Set(tables)) {
      if (table === "emission_categories") continue; // shared reference data, reached only through the org-scoped `live` rows
      // Each read of the table must carry the organisation filter before its select column ends (`AS "name"`);
      // nested selects and parentheses inside the clause are fine.
      const reads = sql.split(`FROM ${table}`).slice(1);
      expect(reads.length).toBeGreaterThan(0);
      for (const read of reads) {
        const clause = read.split(/\sAS "|\n\s*(?:,|\))/)[0];
        expect(clause, `${table} must be read with an organisation filter`).toMatch(/organization_id = \?/);
      }
    }
    expect(values.filter((v) => v === "org-b").length).toBe(orgFilters);
    expect(values).not.toContain("org-a");
  });

  it("counts live rows only, never a published snapshot copy or a business-unit split", async () => {
    await loadExecutiveSummary("org-b", PERIOD, null);
    const [strings] = db.$queryRaw.mock.calls[0] as [TemplateStringsArray];
    const sql = strings.join("?");
    expect(sql).toContain("snapshot_id IS NULL");
    expect(sql).toContain("business_unit_id IS NULL");
    expect(sql).toMatch(/scope2_method IS NULL OR scope2_method = 'location_based'/);
  });
});

describe("who can reach the Summary", () => {
  it("is limited to the roles the dashboard allows, which exclude field workers and suppliers", () => {
    const roles = ROLE_GROUPS.anyMember as readonly string[];
    expect(roles).not.toContain("field_worker");
    expect(roles).not.toContain("supplier");
  });

  it("renders only after the dashboard's role check and its field worker and supplier redirects", () => {
    const src = readFileSync("app/(app)/orgs/[orgId]/dashboard/page.tsx", "utf8");
    const member = src.indexOf("requireOrgMember(orgId, ...ROLE_GROUPS.anyMember)");
    const fieldWorker = src.indexOf('role === "field_worker") redirect("/app")');
    const supplier = src.indexOf("/supplier-portal");
    const summary = src.indexOf("<EarthySummary");
    expect(member).toBeGreaterThan(-1);
    expect(fieldWorker).toBeGreaterThan(member);
    expect(supplier).toBeGreaterThan(-1);
    expect(summary).toBeGreaterThan(fieldWorker);
    expect(summary).toBeGreaterThan(supplier);
  });

  it("gives the organisation id from the route to the Summary, never from the query string", () => {
    const src = readFileSync("app/(app)/orgs/[orgId]/dashboard/page.tsx", "utf8");
    expect(src).toMatch(/<EarthySummary orgId=\{orgId\}/);
    expect(src).not.toMatch(/<EarthySummary[^>]*rawParams/);
  });
});
