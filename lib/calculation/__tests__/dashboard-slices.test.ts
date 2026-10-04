// @vitest-environment node
/**
 * The slice table must reconcile with DashboardAggregate: for the same run, the
 * totals the portal will roll up from slices equal the totals the dashboard
 * already shows from aggregates (read with the real filters), and any subset of
 * dimensions sums each calculation once.
 */
import { describe, expect, it } from "vitest";
import { groupDashboardAggregates } from "../dashboard-groups";
import {
  CATEGORY_BREAKDOWN_DIMENSIONS,
  FACILITY_BREAKDOWN_DIMENSIONS,
  SCOPE_ROLLUP_DIMENSIONS,
} from "../aggregate-filters";
import { groupDashboardSlices, monthOf, type SliceCalcInput } from "../dashboard-slices";

const CATEGORIES = {
  "s1-stationary": { id: "cat-s1", scope: 1 },
  "s2-electricity-lb": { id: "cat-s2lb", scope: 2 },
  "s2-electricity-mb": { id: "cat-s2mb", scope: 2 },
  "s2-heat": { id: "cat-s2h", scope: 2 },
  "s3-purchased-goods": { id: "cat-s3pg", scope: 3 },
} as const;

type Opts = Partial<SliceCalcInput["activityRecord"]>;
function calc(code: keyof typeof CATEGORIES, kg: number, opts: Opts = {}): SliceCalcInput {
  const cat = CATEGORIES[code];
  return {
    totalCo2e: kg,
    activityRecord: {
      emissionCategoryId: cat.id,
      facilityId: null,
      businessUnitId: null,
      siteId: null,
      contractId: null,
      supplierName: null,
      activityDate: new Date("2026-03-15T00:00:00Z"),
      startDate: null,
      emissionCategory: { scope: cat.scope, code },
      ...opts,
    },
  };
}

const primary = (m: string | null) => m === null || m === "location_based";
const sumSlices = (calcs: SliceCalcInput[], pick: (k: ReturnType<typeof groupDashboardSlices>[number]["key"]) => boolean) =>
  groupDashboardSlices(calcs)
    .filter((g) => primary(g.key.scope2Method) && pick(g.key))
    .reduce((t, g) => t + g.totalCo2e, 0);

const FIXTURE: SliceCalcInput[] = [
  calc("s1-stationary", 100, { facilityId: "f1", siteId: "s1", contractId: "c1", supplierName: "Acme Fuels Ltd" }),
  calc("s1-stationary", 50, { facilityId: "f2", siteId: "s2", contractId: "c1", supplierName: "ACME FUELS LIMITED" }),
  calc("s2-electricity-lb", 70, { facilityId: "f1", scope2Method: "location_based" }),
  calc("s2-electricity-mb", 30, { facilityId: "f1", scope2Method: "market_based" }),
  calc("s2-heat", 20, { facilityId: "f2" }),
  calc("s3-purchased-goods", 400, { siteId: "s1", contractId: "c2", supplierName: "Other Co" }),
  calc("s3-purchased-goods", 25, { activityDate: null, startDate: null }),
];

describe("groupDashboardSlices reconciles with groupDashboardAggregates", () => {
  const aggs = groupDashboardAggregates(FIXTURE);
  const where = (g: (typeof aggs)[number], w: Record<string, unknown>): boolean =>
    Object.entries(w).every(([f, c]) => {
      if (f === "OR") return (c as Record<string, unknown>[]).some((x) => where(g, x));
      const v = (g.key as Record<string, unknown>)[f] ?? null;
      if (c !== null && typeof c === "object" && "not" in (c as object)) return v !== (c as { not: unknown }).not;
      return v === c;
    });
  const aggSum = (w: Record<string, unknown>) => aggs.filter((g) => where(g, w)).reduce((t, g) => t + g.totalCo2e, 0);

  it("scope totals match the scope rollup rows", () => {
    for (const scope of [1, 2, 3]) {
      expect(sumSlices(FIXTURE, (k) => k.scope === scope)).toBeCloseTo(
        aggSum({ ...SCOPE_ROLLUP_DIMENSIONS, facilityId: null, scope }),
      );
    }
  });

  it("category totals match the category breakdown rows", () => {
    for (const c of Object.values(CATEGORIES)) {
      expect(sumSlices(FIXTURE, (k) => k.emissionCategoryId === c.id)).toBeCloseTo(
        aggSum({ ...CATEGORY_BREAKDOWN_DIMENSIONS, emissionCategoryId: c.id }),
      );
    }
  });

  it("facility totals match the facility breakdown rows", () => {
    for (const f of ["f1", "f2"]) {
      expect(sumSlices(FIXTURE, (k) => k.facilityId === f)).toBeCloseTo(
        aggSum({ ...FACILITY_BREAKDOWN_DIMENSIONS, facilityId: f }),
      );
    }
  });
});

describe("slice rows", () => {
  it("never double count: every dimension split sums to the same total", () => {
    const total = sumSlices(FIXTURE, () => true);
    const by = (field: "facilityId" | "siteId" | "contractId" | "supplierKey") => {
      const buckets = new Map<string | null, number>();
      for (const g of groupDashboardSlices(FIXTURE).filter((x) => primary(x.key.scope2Method))) {
        buckets.set(g.key[field], (buckets.get(g.key[field]) ?? 0) + g.totalCo2e);
      }
      return [...buckets.values()].reduce((t, v) => t + v, 0);
    };
    for (const f of ["facilityId", "siteId", "contractId", "supplierKey"] as const) expect(by(f)).toBeCloseTo(total);
  });

  it("merges supplier spellings into one key and keeps unnamed suppliers null", () => {
    const rows = groupDashboardSlices(FIXTURE);
    const keys = new Set(rows.map((r) => r.key.supplierKey));
    expect(keys.has("acme fuels")).toBe(true);
    expect([...keys].filter((k) => k?.startsWith("acme")).length).toBe(1);
    expect(keys.has(null)).toBe(true);
  });

  it("writes purchased heat under both methods when the run has market-based electricity", () => {
    const heat = groupDashboardSlices(FIXTURE).filter((r) => r.key.emissionCategoryId === "cat-s2h");
    expect(heat.map((r) => r.key.scope2Method).sort()).toEqual(["location_based", "market_based"].sort());
    const noMarket = groupDashboardSlices([calc("s2-heat", 20)]);
    expect(noMarket).toHaveLength(1);
  });

  it("buckets by month and keeps undated records apart", () => {
    expect(monthOf({ activityDate: new Date("2026-03-31T00:00:00Z"), startDate: null })?.toISOString()).toBe(
      "2026-03-01T00:00:00.000Z",
    );
    expect(monthOf({ activityDate: null, startDate: new Date("2026-12-02T00:00:00Z") })?.getUTCMonth()).toBe(11);
    expect(monthOf({ activityDate: null, startDate: null })).toBeNull();
    const rows = groupDashboardSlices([
      calc("s1-stationary", 1, { activityDate: new Date("2026-03-01T00:00:00Z") }),
      calc("s1-stationary", 2, { activityDate: new Date("2026-03-30T00:00:00Z") }),
      calc("s1-stationary", 4, { activityDate: new Date("2026-04-02T00:00:00Z") }),
      calc("s1-stationary", 8, { activityDate: null }),
    ]);
    expect(rows.map((r) => [r.key.month?.toISOString().slice(0, 7) ?? null, r.totalCo2e, r.count]).sort()).toEqual(
      [["2026-03", 3, 2], ["2026-04", 4, 1], [null, 8, 1]].sort(),
    );
  });

  it("answers a contract slice from slices alone", () => {
    expect(sumSlices(FIXTURE, (k) => k.contractId === "c1")).toBe(150);
  });
});
