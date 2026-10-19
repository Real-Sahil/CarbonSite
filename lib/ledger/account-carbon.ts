/** One ledger account (or the unassigned bucket) in the carbon-by-account view, headline kg CO2e. */
export type AccountCarbonInput = {
  /** Trimmed ledger account; null for approved records that carry none. */
  account: string | null;
  recordCount: number;
  uncalculatedRecordCount: number;
  co2eKg: number;
  /** Spend in the reporting currency, over records that have a calculation. */
  spendAmount: number;
  /** The same records' headline kg CO2e, so intensity compares like with like. */
  spendCo2eKg: number;
  spendRecordCount: number;
  /** Records with spend in another currency. Counted, never converted here, so left out of intensity. */
  otherCurrencyRecordCount: number;
};

export type AccountCarbonRow = AccountCarbonInput & {
  /** kg CO2e per unit of reporting-currency spend. Null when the account has no spend to divide by. */
  kgPerUnitSpend: number | null;
};

export type CarbonByAccountView = {
  /** Largest headline emissions first; ties go alphabetically. */
  accounts: AccountCarbonRow[];
  unassigned: AccountCarbonRow | null;
  /** Headline kg CO2e over every approved record, assigned or not. */
  totalCo2eKg: number;
};

const withIntensity = (row: AccountCarbonInput): AccountCarbonRow => ({
  ...row,
  kgPerUnitSpend: row.spendAmount > 0 ? row.spendCo2eKg / row.spendAmount : null,
});

/**
 * Turns one row per ledger account into the view: intensity per unit of spend,
 * the unassigned bucket split out, accounts ranked by emissions. Pure, so the
 * ranking and the spend rule are tested without a database.
 */
export function summariseAccounts(inputs: AccountCarbonInput[]): CarbonByAccountView {
  const accounts = inputs
    .filter((r) => r.account !== null)
    .map(withIntensity)
    .sort((a, b) => b.co2eKg - a.co2eKg || (a.account ?? "").localeCompare(b.account ?? ""));
  const unassignedInput = inputs.find((r) => r.account === null);
  return {
    accounts,
    unassigned: unassignedInput ? withIntensity(unassignedInput) : null,
    totalCo2eKg: inputs.reduce((sum, r) => sum + r.co2eKg, 0),
  };
}
