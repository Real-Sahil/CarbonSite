import { supplierKey } from "@/lib/social-value/local-spend";
import { reportingRows, type DashboardCalcInput } from "./dashboard-groups";
import { countsTowardHeadline } from "./scope2-method";

type Money = number | string | { toString(): string } | null;

/** A run calculation with the record fields the supplier table reads. */
export type PriorityCalcInput = {
  totalCo2e: DashboardCalcInput["totalCo2e"];
  activityRecord: DashboardCalcInput["activityRecord"] & {
    id: string;
    supplierName: string | null;
    spendAmount: Money;
    spendCurrency: string | null;
    activityDate: Date | null;
    startDate: Date | null;
  };
};

/** Converts `amount` between currencies at the rate for `onDate`. Null when no rate is known. */
export type SpendConverter = (amount: number, from: string, to: string, onDate: Date | null) => number | null;

export type SupplierPriority = {
  /** The key DashboardSlice.supplierKey uses, so the two tables reconcile. */
  supplierKey: string;
  /** Most frequent spelling of the name in the run's records; ties go alphabetically. */
  supplierName: string;
  /** Nominal spend in the reporting currency, to the penny. */
  spendAmount: number;
  spendCurrency: string;
  spendRecordCount: number;
  unconvertedSpendRecordCount: number;
  /** Headline (location-based) kg CO2e, as the dashboard counts it. */
  totalCo2eKg: number;
  recordCount: number;
  /** 1 is the largest spend. Null when the supplier has no spend to rank. */
  spendRank: number | null;
  /** 1 is the largest headline emissions. Null when there are none to rank. */
  emissionsRank: number | null;
};

type Accumulator = {
  spokenNames: Map<string, number>;
  spend: number;
  spendRecordCount: number;
  unconvertedSpendRecordCount: number;
  co2eKg: number;
  recordCount: number;
};

function amountOf(value: Money): number | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const cleanName = (name: string) => name.trim().replace(/\s+/g, " ");

function dateOf(record: { activityDate: Date | null; startDate: Date | null }): Date | null {
  return record.activityDate ?? record.startDate ?? null;
}

function mostFrequentName(spoken: Map<string, number>, fallback: string): string {
  const [first] = [...spoken.entries()].sort(([a, x], [b, y]) => y - x || a.localeCompare(b));
  return first?.[0] ?? fallback;
}

/**
 * One row per supplier for a calculation run, with spend in the reporting
 * currency and headline emissions. Spend and record counts are taken once per
 * activity record; emissions follow the dashboard's headline rule, so purchased
 * heat is counted once and market-based Scope 2 is left out. Records with no
 * supplier name are not ranked.
 */
export function groupSupplierPriorities(
  calculations: PriorityCalcInput[],
  options: { reportingCurrency: string; convert: SpendConverter },
): SupplierPriority[] {
  const reporting = options.reportingCurrency.trim().toUpperCase();
  const groups = new Map<string, Accumulator>();
  const groupFor = (key: string) => {
    let group = groups.get(key);
    if (!group) {
      group = {
        spokenNames: new Map(),
        spend: 0,
        spendRecordCount: 0,
        unconvertedSpendRecordCount: 0,
        co2eKg: 0,
        recordCount: 0,
      };
      groups.set(key, group);
    }
    return group;
  };

  const counted = new Set<string>();
  for (const { activityRecord: r } of calculations) {
    const key = r.supplierName ? supplierKey(r.supplierName) : "";
    if (!key || counted.has(r.id)) continue;
    counted.add(r.id);

    const group = groupFor(key);
    group.recordCount += 1;
    const spoken = cleanName(r.supplierName ?? "");
    group.spokenNames.set(spoken, (group.spokenNames.get(spoken) ?? 0) + 1);

    const amount = amountOf(r.spendAmount);
    if (amount === null || amount <= 0) continue;
    const currency = r.spendCurrency?.trim().toUpperCase() || reporting;
    const converted = currency === reporting ? amount : options.convert(amount, currency, reporting, dateOf(r));
    if (converted === null) {
      group.unconvertedSpendRecordCount += 1;
    } else {
      group.spend += converted;
      group.spendRecordCount += 1;
    }
  }

  for (const { calc, scope2Method } of reportingRows(calculations)) {
    if (!countsTowardHeadline(scope2Method)) continue;
    const name = calc.activityRecord.supplierName;
    const key = name ? supplierKey(name) : "";
    if (!key) continue;
    groupFor(key).co2eKg += Number(calc.totalCo2e);
  }

  const rows = [...groups.entries()].map(([key, g]) => ({
    supplierKey: key,
    supplierName: mostFrequentName(g.spokenNames, key),
    spendAmount: round2(g.spend),
    spendCurrency: reporting,
    spendRecordCount: g.spendRecordCount,
    unconvertedSpendRecordCount: g.unconvertedSpendRecordCount,
    totalCo2eKg: Math.round(g.co2eKg * 1e8) / 1e8,
    recordCount: g.recordCount,
    spendRank: null as number | null,
    emissionsRank: null as number | null,
  }));

  const bySpend = rows
    .filter((r) => r.spendRecordCount > 0)
    .sort((a, b) => b.spendAmount - a.spendAmount || a.supplierName.localeCompare(b.supplierName) || a.supplierKey.localeCompare(b.supplierKey));
  bySpend.forEach((r, i) => {
    r.spendRank = i + 1;
  });

  const byEmissions = rows
    .filter((r) => r.totalCo2eKg > 0)
    .sort((a, b) => b.totalCo2eKg - a.totalCo2eKg || a.supplierName.localeCompare(b.supplierName) || a.supplierKey.localeCompare(b.supplierKey));
  byEmissions.forEach((r, i) => {
    r.emissionsRank = i + 1;
  });

  return rows.sort(
    (a, b) =>
      (a.spendRank ?? Number.MAX_SAFE_INTEGER) - (b.spendRank ?? Number.MAX_SAFE_INTEGER) ||
      (a.emissionsRank ?? Number.MAX_SAFE_INTEGER) - (b.emissionsRank ?? Number.MAX_SAFE_INTEGER) ||
      a.supplierName.localeCompare(b.supplierName),
  );
}
