import { describe, expect, it } from "vitest";
import {
  applyProfile,
  matchRule,
  parseLedgerDate,
  parseLedgerNumber,
  PROFILED_COLUMN_MAP,
  profileSpecSchema,
  resolveColumns,
  summariseProfile,
  type ProfileRule,
  type ProfileSpec,
} from "../profiles";
import { PROFILE_TEMPLATES, templateFor } from "../profile-templates";
import { validateRow } from "../validator";

const rule = (r: Partial<ProfileRule>): ProfileRule => ({ action: "include", basis: "spend", ...r }) as ProfileRule;

describe("matchRule", () => {
  const rules = [
    rule({ account: "5*", categoryCode: "s3-purchased-goods" }),
    rule({ account: "5000-5999", categoryCode: "s3-capital-goods" }),
    rule({ account: "5100-5199", categoryCode: "s1-mobile" }),
    rule({ account: "5150", categoryCode: "s2-electricity-lb" }),
    rule({ account: "5150", costCode: "SITE-A", categoryCode: "s1-stationary" }),
    rule({ costCode: "OH*", action: "ignore" }),
  ];

  it("prefers exact over range over prefix, and the narrower range", () => {
    expect(matchRule(rules, "5150", undefined)?.rule.categoryCode).toBe("s2-electricity-lb");
    expect(matchRule(rules, "5120", undefined)?.rule.categoryCode).toBe("s1-mobile");
    expect(matchRule(rules, "5900", undefined)?.rule.categoryCode).toBe("s3-capital-goods");
    expect(matchRule(rules, "5A", undefined)?.rule.categoryCode).toBe("s3-purchased-goods");
  });

  it("adds account and cost code scores so a combined rule wins", () => {
    expect(matchRule(rules, "5150", "site-a")?.rule.categoryCode).toBe("s1-stationary");
  });

  it("needs every pattern a rule names to match", () => {
    expect(matchRule([rule({ account: "5150", costCode: "SITE-A", categoryCode: "x" })], "5150", "SITE-B")).toBeNull();
    expect(matchRule(rules, "7100", "OH-01")?.rule.action).toBe("ignore");
    expect(matchRule(rules, "7100", undefined)).toBeNull();
  });

  it("gives ties to the rule listed first", () => {
    const tied = [rule({ account: "6000", categoryCode: "first" }), rule({ account: "6000", categoryCode: "second" })];
    expect(matchRule(tied, "6000", undefined)?.index).toBe(0);
  });
});

describe("parseLedgerNumber", () => {
  it("reads UK, EU, bracketed and trailing-minus amounts", () => {
    expect(parseLedgerNumber("1,234.56", "uk")).toBe(1234.56);
    expect(parseLedgerNumber("1.234,56", "eu")).toBe(1234.56);
    expect(parseLedgerNumber("(120.00)", "uk")).toBe(-120);
    expect(parseLedgerNumber("120.00-", "uk")).toBe(-120);
    expect(parseLedgerNumber("£ 99", "uk")).toBe(99);
    expect(parseLedgerNumber("GBP-5", "uk")).toBe(-5);
    expect(parseLedgerNumber("n/a", "uk")).toBeNull();
    expect(parseLedgerNumber("", "uk")).toBeNull();
  });
});

describe("parseLedgerDate", () => {
  it("reads day-first by default and rejects impossible dates", () => {
    expect(parseLedgerDate("03/04/2025", "dmy")).toBe("2025-04-03");
    expect(parseLedgerDate("03.04.25", "dmy")).toBe("2025-04-03");
    expect(parseLedgerDate("03/04/2025", "mdy")).toBe("2025-03-04");
    expect(parseLedgerDate("2025-04-03", "mdy")).toBe("2025-04-03");
    expect(parseLedgerDate("31/02/2025", "dmy")).toBeNull();
    expect(parseLedgerDate("soon", "dmy")).toBeNull();
  });
});

describe("applyProfile", () => {
  const spec: ProfileSpec = profileSpecSchema.parse({
    sourceSystem: "sage",
    columns: { date: "Date", account: "N/C", costCode: "Dept", netAmount: "Net", description: "Details", supplier: "Supplier", quantity: "Qty", reference: "Ref" },
    rules: [
      { account: "7200", action: "include", categoryCode: "s2-electricity-lb" },
      { account: "7300", action: "include", categoryCode: "s1-mobile", basis: "quantity", unit: "litres", fuelType: "Diesel" },
      { account: "5000-5099", action: "include", categoryCode: "s3-purchased-goods", industryCode: "23.6", facilityName: "Depot" },
      { account: "7000-7099", action: "ignore", note: "Payroll" },
    ],
  });
  const line = (r: Record<string, string>) => ({ Date: "15/05/2025", "N/C": "", Dept: "", Net: "", Details: "", Supplier: "", Qty: "", Ref: "", ...r });

  it("turns a spend line into a canonical record the validator accepts", () => {
    const [out] = applyProfile([line({ "N/C": "5010", Net: "2,400.00", Details: "Ready-mix C32/40", Supplier: "Acme Concrete", Ref: "INV-9" })], spec);
    expect(out.kind).toBe("row");
    if (out.kind !== "row") return;
    expect(out.row).toMatchObject({
      emissionCategoryCode: "s3-purchased-goods",
      activityDate: "2025-05-15",
      amount: "2400",
      unit: "GBP",
      spendAmount: "2400",
      spendCurrency: "GBP",
      industryCode: "23.6",
      facilityName: "Depot",
      supplierName: "Acme Concrete",
      sourceDescription: "Sage INV-9 Ready-mix C32/40",
      dataOrigin: "invoiced",
    });
    const validated = validateRow(out.row, PROFILED_COLUMN_MAP, new Map([["s3-purchased-goods", "cat1"]]), new Map([["depot", "fac1"]]), new Map());
    expect(validated.errors).toEqual([]);
    expect(validated.data).toMatchObject({ amount: 2400, unit: "GBP", emissionCategoryId: "cat1", facilityId: "fac1", spendAmount: 2400, industryCode: "23.6" });
  });

  it("uses the quantity for a quantity rule and keeps the spend beside it", () => {
    const [out] = applyProfile([line({ "N/C": "7300", Net: "650", Qty: "500" })], spec);
    expect(out.kind === "row" && out.row).toMatchObject({ amount: "500", unit: "litres", fuelType: "Diesel", spendAmount: "650" });
  });

  it("leaves out unmatched, ignored, credit and zero lines with a reason", () => {
    const out = applyProfile(
      [line({ "N/C": "8100", Net: "10", Details: "Bank charges" }), line({ "N/C": "7005", Net: "900" }), line({ "N/C": "7200", Net: "(40.00)" }), line({ "N/C": "7200", Net: "0" }), line({})],
      spec,
    );
    expect(out.map((o) => o.kind)).toEqual(["excluded", "excluded", "excluded", "excluded", "excluded"]);
    expect(out.map((o) => (o.kind === "excluded" ? o.actionable : null))).toEqual([true, false, true, false, true]);
    expect(out[0].kind === "excluded" && out[0].reason).toContain("No rule for account 8100 (Bank charges)");
    expect(out[2].kind === "excluded" && out[2].reason).toContain("Credit line");
  });

  it("passes an unreadable date through so the validator reports it", () => {
    const [out] = applyProfile([line({ "N/C": "7200", Net: "100", Date: "next week" })], spec);
    const validated = out.kind === "row" ? validateRow(out.row, PROFILED_COLUMN_MAP, new Map([["s2-electricity-lb", "c"]]), new Map(), new Map()) : null;
    expect(validated?.errors.map((e) => e.field)).toEqual(["activityDate"]);
  });
});

describe("summariseProfile", () => {
  it("lists codes still needing a rule, largest first, and totals by category", () => {
    const spec = profileSpecSchema.parse({
      sourceSystem: "generic",
      columns: { date: "Date", account: "Account", netAmount: "Net", description: "Desc" },
      rules: [
        { account: "7200", action: "include", categoryCode: "s2-electricity-lb" },
        { account: "7000", action: "ignore" },
      ],
    });
    const rows = [
      { Date: "01/04/2025", Account: "7200", Net: "300", Desc: "Power" },
      { Date: "01/05/2025", Account: "7200", Net: "200", Desc: "Power" },
      { Date: "01/05/2025", Account: "7200", Net: "-50", Desc: "Credit" },
      { Date: "01/05/2025", Account: "7000", Net: "9000", Desc: "Wages" },
      { Date: "01/05/2025", Account: "7400", Net: "80", Desc: "Hotel" },
      { Date: "02/05/2025", Account: "7400", Net: "20", Desc: "Hotel" },
      { Date: "02/05/2025", Account: "7300", Net: "900", Desc: "Diesel" },
    ];
    const s = summariseProfile(rows, spec);
    expect(s).toMatchObject({ lines: 7, included: 2, ignored: 1, needsAttention: 4 });
    expect(s.unmatched).toEqual([
      { account: "7300", costCode: undefined, lines: 1, netAmount: 900, example: "Diesel" },
      { account: "7400", costCode: undefined, lines: 2, netAmount: 100, example: "Hotel" },
    ]);
    expect(s.byCategory).toEqual([{ categoryCode: "s2-electricity-lb", lines: 2, netAmount: 500 }]);
  });
});

describe("profileSpecSchema", () => {
  it("requires a date, a code column and an amount column", () => {
    expect(profileSpecSchema.safeParse({ sourceSystem: "sap", columns: { date: "D", account: "A" }, rules: [] }).success).toBe(false);
    expect(profileSpecSchema.safeParse({ sourceSystem: "sap", columns: { date: "D", netAmount: "N" }, rules: [] }).success).toBe(false);
    expect(profileSpecSchema.safeParse({ sourceSystem: "sap", columns: { date: "D", account: "A", netAmount: "N" }, rules: [] }).success).toBe(true);
  });

  it("rejects include rules without a category and rules without a code", () => {
    const base = { sourceSystem: "sap", columns: { date: "D", account: "A", netAmount: "N" } };
    expect(profileSpecSchema.safeParse({ ...base, rules: [{ account: "1", action: "include" }] }).success).toBe(false);
    expect(profileSpecSchema.safeParse({ ...base, rules: [{ action: "ignore" }] }).success).toBe(false);
  });
});

describe("templates", () => {
  it("resolve against a Sage 50 nominal activity header row", () => {
    const cols = resolveColumns(templateFor("sage").columns, ["Type", "Date", "Ref", "N/C", "Dept", "Details", "Net", "T/C", "Tax", "A/C"]);
    expect(cols).toEqual({ date: "Date", account: "N/C", costCode: "Dept", netAmount: "Net", description: "Details", supplier: "A/C", reference: "Ref" });
  });

  it("resolve SAP headers regardless of case and punctuation", () => {
    const cols = resolveColumns(templateFor("sap").columns, ["pstng date", "G/L Acct", "Amount in local cur.", "LCurr", "Text", "Cost Ctr"]);
    expect(cols).toMatchObject({ date: "pstng date", account: "G/L Acct", netAmount: "Amount in local cur.", currency: "LCurr", costCode: "Cost Ctr", description: "Text" });
  });

  it("cover every source system once", () => {
    expect(new Set(PROFILE_TEMPLATES.map((t) => t.sourceSystem)).size).toBe(PROFILE_TEMPLATES.length);
  });
});
