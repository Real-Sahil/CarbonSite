// @vitest-environment node
import { describe, expect, it } from "vitest";
import { summariseAccounts, type AccountCarbonInput } from "../account-carbon";

const row = (over: Partial<AccountCarbonInput>): AccountCarbonInput => ({
  account: "4000",
  recordCount: 1,
  uncalculatedRecordCount: 0,
  co2eKg: 0,
  spendAmount: 0,
  spendCo2eKg: 0,
  spendRecordCount: 0,
  otherCurrencyRecordCount: 0,
  ...over,
});

describe("summariseAccounts", () => {
  it("ranks accounts by emissions, ties alphabetically", () => {
    const view = summariseAccounts([
      row({ account: "6100", co2eKg: 500 }),
      row({ account: "5200", co2eKg: 900 }),
      row({ account: "4000", co2eKg: 500 }),
    ]);
    expect(view.accounts.map((a) => a.account)).toEqual(["5200", "4000", "6100"]);
  });

  it("gives intensity only from records with spend, and null when there is none", () => {
    const view = summariseAccounts([
      row({ account: "6100", co2eKg: 1000, spendAmount: 200, spendCo2eKg: 400 }),
      row({ account: "6200", co2eKg: 300, spendAmount: 0, spendCo2eKg: 0 }),
    ]);
    const byAccount = Object.fromEntries(view.accounts.map((a) => [a.account, a.kgPerUnitSpend]));
    expect(byAccount["6100"]).toBe(2);
    expect(byAccount["6200"]).toBeNull();
  });

  it("uses only spend-bearing records for the intensity numerator, not the whole account", () => {
    // 1000 kg total, but only 400 kg belongs to the 200 of spend. Intensity is 2, not 5.
    const view = summariseAccounts([
      row({ account: "6100", co2eKg: 1000, spendAmount: 200, spendCo2eKg: 400, spendRecordCount: 1 }),
    ]);
    expect(view.accounts[0].kgPerUnitSpend).toBe(2);
  });

  it("splits the unassigned bucket out of the ranked accounts but keeps it in the total", () => {
    const view = summariseAccounts([
      row({ account: null, co2eKg: 700 }),
      row({ account: "4000", co2eKg: 300 }),
    ]);
    expect(view.accounts.map((a) => a.account)).toEqual(["4000"]);
    expect(view.unassigned?.co2eKg).toBe(700);
    expect(view.totalCo2eKg).toBe(1000);
  });

  it("returns no unassigned row when every record has an account", () => {
    const view = summariseAccounts([row({ account: "4000", co2eKg: 300 })]);
    expect(view.unassigned).toBeNull();
    expect(view.totalCo2eKg).toBe(300);
  });

  it("returns an empty view for no rows", () => {
    expect(summariseAccounts([])).toEqual({ accounts: [], unassigned: null, totalCo2eKg: 0 });
  });
});
