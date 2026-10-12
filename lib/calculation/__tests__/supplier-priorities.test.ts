// @vitest-environment node
/**
 * Supplier priorities are one row per supplier per run. Their headline emissions
 * must reconcile with the dashboard slice table summed by supplier key, and spend
 * must count each activity record once, however many Scope 2 rows it writes.
 */
import { describe, expect, it } from "vitest";
import { supplierKey } from "@/lib/social-value/local-spend";
import { groupDashboardSlices, type SliceCalcInput } from "../dashboard-slices";
import { groupSupplierPriorities, type PriorityCalcInput, type SpendConverter } from "../supplier-priorities";

const CATEGORIES = {
  "s1-stationary": { id: "cat-s1", scope: 1 },
  "s2-electricity-lb": { id: "cat-s2lb", scope: 2 },
  "s2-electricity-mb": { id: "cat-s2mb", scope: 2 },
  "s2-heat": { id: "cat-s2h", scope: 2 },
  "s3-purchased-goods": { id: "cat-s3pg", scope: 3 },
} as const;

type Fixture = PriorityCalcInput & SliceCalcInput;
type Opts = Partial<Fixture["activityRecord"]>;

let nextId = 0;
function calc(code: keyof typeof CATEGORIES, kg: number, opts: Opts = {}): Fixture {
  const cat = CATEGORIES[code];
  nextId += 1;
  return {
    totalCo2e: kg,
    activityRecord: {
      id: `rec-${nextId}`,
      emissionCategoryId: cat.id,
      facilityId: null,
      businessUnitId: null,
      siteId: null,
      contractId: null,
      supplierName: null,
      spendAmount: null,
      spendCurrency: null,
      activityDate: new Date("2026-03-15T00:00:00Z"),
      startDate: null,
      emissionCategory: { scope: cat.scope, code },
      ...opts,
    },
  };
}

/** GBP reporting; EUR converts at 0.85 GBP per EUR. Other currencies have no rate. */
const convert: SpendConverter = (amount, from, to) => {
  if (from === "EUR" && to === "GBP") return amount * 0.85;
  return null;
};

/** The row for a supplier name, matched through the same key the dashboard slices use. */
const byName = (rows: ReturnType<typeof groupSupplierPriorities>, name: string) => {
  const row = rows.find((r) => r.supplierKey === supplierKey(name));
  if (!row) throw new Error(`no row for ${name}`);
  return row;
};

const run = (calcs: PriorityCalcInput[]) => groupSupplierPriorities(calcs, { reportingCurrency: "GBP", convert });

describe("groupSupplierPriorities: grouping and names", () => {
  it("merges spelling variants under one supplier and names the most frequent spelling", () => {
    const rows = run([
      calc("s1-stationary", 100, { supplierName: "Acme Fuels Ltd" }),
      calc("s1-stationary", 50, { supplierName: "ACME FUELS LIMITED" }),
      calc("s1-stationary", 30, { supplierName: "Acme Fuels Ltd" }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ supplierName: "Acme Fuels Ltd", recordCount: 3, totalCo2eKg: 180 });
  });

  it("breaks a tie between spellings alphabetically", () => {
    const rows = run([
      calc("s1-stationary", 10, { supplierName: "Zeta Plant Hire" }),
      calc("s1-stationary", 10, { supplierName: "Alpha Plant Hire" }),
    ]);
    expect(rows[0].supplierName).toBe("Alpha Plant Hire");
  });

  it("skips records with no supplier name, and names that normalise to nothing", () => {
    const rows = run([
      calc("s1-stationary", 100, { supplierName: null }),
      calc("s1-stationary", 100, { supplierName: "Ltd" }),
      calc("s1-stationary", 100, { supplierName: "  " }),
    ]);
    expect(rows).toEqual([]);
  });
});

describe("groupSupplierPriorities: spend", () => {
  it("counts a purchased heat record's spend once when its emissions are written under both methods", () => {
    const heat = calc("s2-heat", 20, { supplierName: "Heat Co", spendAmount: "400.00", spendCurrency: "GBP" });
    const electricity = calc("s2-electricity-mb", 30, { supplierName: "Power Ltd", scope2Method: "market_based" });
    const rows = run([heat, electricity]);
    const heatRow = byName(rows, "heat co");
    expect(heatRow.spendAmount).toBe(400);
    expect(heatRow.spendRecordCount).toBe(1);
    expect(heatRow.totalCo2eKg).toBe(20);
  });

  it("converts spend at the injected rate and counts a record it cannot convert separately", () => {
    const rows = run([
      calc("s3-purchased-goods", 10, { supplierName: "Euro Supplies", spendAmount: "1000", spendCurrency: "EUR" }),
      calc("s3-purchased-goods", 10, { supplierName: "Euro Supplies", spendAmount: "200", spendCurrency: "XYZ" }),
    ]);
    const row = byName(rows, "euro supplies");
    expect(row.spendAmount).toBe(850);
    expect(row.spendRecordCount).toBe(1);
    expect(row.unconvertedSpendRecordCount).toBe(1);
    expect(row.spendCurrency).toBe("GBP");
  });

  it("treats a missing spend currency as the reporting currency", () => {
    const rows = run([calc("s3-purchased-goods", 10, { supplierName: "No Ccy", spendAmount: "120.50", spendCurrency: null })]);
    expect(byName(rows, "no ccy").spendAmount).toBe(120.5);
  });

  it("does not count zero, negative or missing spend as a spend record", () => {
    const rows = run([
      calc("s3-purchased-goods", 10, { supplierName: "Free Stuff", spendAmount: "0" }),
      calc("s3-purchased-goods", 10, { supplierName: "Free Stuff", spendAmount: "-50" }),
      calc("s3-purchased-goods", 10, { supplierName: "Free Stuff", spendAmount: null }),
    ]);
    const row = byName(rows, "free stuff");
    expect(row.spendRecordCount).toBe(0);
    expect(row.unconvertedSpendRecordCount).toBe(0);
    expect(row.spendRank).toBeNull();
    expect(row.recordCount).toBe(3);
  });
});

describe("groupSupplierPriorities: ranks", () => {
  it("ranks spend and emissions largest first, and breaks ties by name", () => {
    const rows = run([
      calc("s3-purchased-goods", 500, { supplierName: "Big Emitter", spendAmount: "100" }),
      calc("s3-purchased-goods", 10, { supplierName: "Big Spender", spendAmount: "900" }),
      calc("s3-purchased-goods", 10, { supplierName: "Tie Beta", spendAmount: "300" }),
      calc("s3-purchased-goods", 10, { supplierName: "Tie Alpha", spendAmount: "300" }),
    ]);
    expect(byName(rows, "big spender")).toMatchObject({ spendRank: 1, emissionsRank: 2 });
    expect(byName(rows, "tie alpha")).toMatchObject({ spendRank: 2, emissionsRank: 3 });
    expect(byName(rows, "tie beta")).toMatchObject({ spendRank: 3, emissionsRank: 4 });
    expect(byName(rows, "big emitter")).toMatchObject({ spendRank: 4, emissionsRank: 1 });
  });

  it("leaves a supplier with no emissions unranked on emissions", () => {
    const rows = run([calc("s3-purchased-goods", 0, { supplierName: "Paper Only", spendAmount: "50" })]);
    expect(byName(rows, "paper only")).toMatchObject({ spendRank: 1, emissionsRank: null });
  });
});

describe("groupSupplierPriorities: reconciliation with dashboard slices", () => {
  it("matches the slice table's headline emissions for every supplier", () => {
    const calcs: Fixture[] = [
      calc("s1-stationary", 100, { supplierName: "Acme Fuels Ltd", facilityId: "f1", siteId: "s1" }),
      calc("s1-stationary", 50, { supplierName: "ACME FUELS LIMITED", facilityId: "f2", siteId: "s2" }),
      calc("s2-electricity-lb", 70, { supplierName: "Grid Co", scope2Method: "location_based" }),
      calc("s2-electricity-mb", 30, { supplierName: "Grid Co", scope2Method: "market_based" }),
      calc("s2-heat", 20, { supplierName: "Heat Co" }),
      calc("s3-purchased-goods", 400, { supplierName: "Other Co", siteId: "s1", contractId: "c2" }),
      calc("s3-purchased-goods", 25, { activityDate: null, startDate: null }),
    ];
    const rows = run(calcs);
    const slices = groupDashboardSlices(calcs);
    for (const row of rows) {
      const fromSlices = slices
        .filter((s) => s.key.supplierKey === row.supplierKey && (s.key.scope2Method === null || s.key.scope2Method === "location_based"))
        .reduce((t, s) => t + s.totalCo2e, 0);
      expect(row.totalCo2eKg).toBeCloseTo(fromSlices, 6);
    }
    expect(byName(rows, "grid co").totalCo2eKg).toBe(70);
    expect(byName(rows, "heat co").totalCo2eKg).toBe(20);
  });
});
