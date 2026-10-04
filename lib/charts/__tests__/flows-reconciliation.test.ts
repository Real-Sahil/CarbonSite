// @vitest-environment node
/**
 * The Sankey reads slices, the headline reads aggregates: for the same run the
 * diagram's total, and each scope node, must equal the aggregate scope rollup
 * the dashboard headline shows (and so the report).
 */
import { describe, expect, it } from "vitest";
import { groupDashboardAggregates } from "@/lib/calculation/dashboard-groups";
import { SCOPE_ROLLUP_DIMENSIONS } from "@/lib/calculation/aggregate-filters";
import { groupDashboardSlices, type SliceCalcInput } from "@/lib/calculation/dashboard-slices";
import { buildFlows } from "../sankey";

const CAT = { "s1-stationary": ["cat-s1", 1], "s2-electricity-lb": ["cat-s2lb", 2], "s2-electricity-mb": ["cat-s2mb", 2], "s2-heat": ["cat-s2h", 2], "s3-purchased-goods": ["cat-s3pg", 3] } as const;
const calc = (code: keyof typeof CAT, kg: number, o: Partial<SliceCalcInput["activityRecord"]> = {}): SliceCalcInput => ({
  totalCo2e: kg,
  activityRecord: {
    emissionCategoryId: CAT[code][0], facilityId: null, businessUnitId: null, siteId: null, contractId: null,
    supplierName: null, activityDate: new Date("2026-03-15T00:00:00Z"), startDate: null,
    emissionCategory: { scope: CAT[code][1], code }, ...o,
  },
});

const FIXTURE = [
  calc("s1-stationary", 100, { facilityId: "f1" }),
  calc("s1-stationary", 50, { facilityId: "f2" }),
  calc("s2-electricity-lb", 70, { facilityId: "f1", scope2Method: "location_based" }),
  calc("s2-electricity-mb", 30, { facilityId: "f1", scope2Method: "market_based" }),
  calc("s2-heat", 20, { facilityId: "f2" }),
  calc("s3-purchased-goods", 400),
];

describe("Sankey reconciles with the dashboard headline", () => {
  const rows = groupDashboardSlices(FIXTURE)
    .filter((g) => g.key.scope2Method === null || g.key.scope2Method === "location_based")
    .map((g) => ({ scope: g.key.scope, emissionCategoryId: g.key.emissionCategoryId, facilityId: g.key.facilityId, totalCo2e: g.totalCo2e }));
  const flows = buildFlows(rows, { category: (id) => id, facility: (id) => id });
  const aggs = groupDashboardAggregates(FIXTURE);
  const rollup = (scope: number) =>
    aggs
      .filter((g) => {
        const k = g.key as Record<string, unknown>;
        const m = k.scope2Method ?? null;
        return k.scope === scope && !k.emissionCategoryId && !k.facilityId && !k.businessUnitId && (m === null || m === "location_based") && Object.keys(SCOPE_ROLLUP_DIMENSIONS).length > 0;
      })
      .reduce((t, g) => t + g.totalCo2e, 0);

  it("has the same total as the three scope rollups", () => {
    expect(flows.totalKg).toBeCloseTo(rollup(1) + rollup(2) + rollup(3));
    expect(flows.totalKg).toBeCloseTo(640);
  });

  it("each scope node carries its scope's rollup", () => {
    for (const scope of [1, 2, 3]) {
      const out = flows.links.filter((l) => l.source === `scope:${scope}`).reduce((t, l) => t + l.value, 0);
      expect(out).toBeCloseTo(rollup(scope));
    }
  });
});
