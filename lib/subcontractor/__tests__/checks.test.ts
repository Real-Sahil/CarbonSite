import { describe, expect, it } from "vitest";
import { type CheckRow, checkSubmissions } from "@/lib/subcontractor/checks";

// Due dates are UTC calendar days, as on the contract page.
const DUE = (iso: string) => new Date(`${iso}T00:00:00Z`);

function row(overrides: Partial<CheckRow> = {}): CheckRow {
  return {
    id: "r1",
    subcontractorName: "Acme Groundworks",
    reportingPeriodLabel: "Q1 2026",
    dueDate: DUE("2026-04-30"),
    status: "submitted",
    scope1Tco2e: "10.0000",
    scope2Tco2e: "2.0000",
    scope3Tco2e: "5.0000",
    evidenceStorageKey: "org/org_1/subcontractor/r1/evidence.pdf",
    ...overrides,
  };
}

/** The warnings for the row with id `id`, as messages. */
function messagesFor(rows: CheckRow[], id = "r1") {
  return (checkSubmissions(rows).get(id) ?? []).map((w) => w.message);
}

function codesFor(rows: CheckRow[], id = "r1") {
  return (checkSubmissions(rows).get(id) ?? []).map((w) => w.code);
}

describe("checkSubmissions: which requests are checked", () => {
  it("checks only submitted requests, the figures the verifier is deciding on", () => {
    const rows = [
      row({ id: "a", status: "requested" }),
      row({ id: "b", status: "overdue" }),
      row({ id: "c", status: "rejected" }),
      row({ id: "d", status: "verified" }),
    ];
    expect(checkSubmissions(rows).size).toBe(0);
  });

  it("gives a clean submitted request an empty list", () => {
    expect(messagesFor([row()])).toEqual([]);
  });
});

describe("checkSubmissions: checks on the row alone", () => {
  it("flags a negative scope and names it", () => {
    const rows = [row({ scope2Tco2e: "-1.5000" })];
    expect(messagesFor(rows)).toEqual([
      "Scope 2 is negative (-1.50 tCO₂e). Check the sign with the subcontractor before verifying.",
    ]);
  });

  it("flags a request where every scope entered is zero", () => {
    const rows = [row({ scope1Tco2e: "0", scope2Tco2e: "0", scope3Tco2e: null })];
    expect(codesFor(rows)).toContain("all_zero");
  });

  it("does not flag zero when another scope has a figure", () => {
    const rows = [row({ scope1Tco2e: "0", scope2Tco2e: "3", scope3Tco2e: null })];
    expect(codesFor(rows)).not.toContain("all_zero");
  });

  it("does not call a request with no scopes entered all zero", () => {
    const rows = [row({ scope1Tco2e: null, scope2Tco2e: null, scope3Tco2e: null })];
    expect(codesFor(rows)).not.toContain("all_zero");
  });

  it("flags a submitted figure with no evidence file, and still lets it be verified", () => {
    const rows = [row({ evidenceStorageKey: null })];
    expect(messagesFor(rows)).toEqual(["No evidence file attached. You can still verify."]);
  });

  it("reports every problem on the row, not only the first", () => {
    const rows = [row({ scope1Tco2e: "-2", evidenceStorageKey: null })];
    expect(codesFor(rows)).toEqual(["negative", "no_evidence"]);
  });

  it("reads Decimal-shaped and string figures alike", () => {
    const decimal = (value: string) => ({ toString: () => value });
    const rows = [row({ scope1Tco2e: decimal("-4.0000"), scope2Tco2e: "0.0000", scope3Tco2e: 0 })];
    expect(codesFor(rows)).toContain("negative");
    expect(codesFor(rows)).not.toContain("all_zero");
  });
});

describe("checkSubmissions: change from the previous period", () => {
  const previous = (overrides: Partial<CheckRow> = {}) =>
    row({
      id: "prev",
      reportingPeriodLabel: "Q4 2025",
      dueDate: DUE("2026-01-31"),
      status: "verified",
      scope1Tco2e: "10.0000",
      scope2Tco2e: "2.0000",
      scope3Tco2e: "5.0000",
      ...overrides,
    });

  it("flags a rise of exactly 50% on a scope, against the previous period's label", () => {
    const rows = [row({ scope1Tco2e: "15.0000" }), previous()];
    expect(messagesFor(rows)).toEqual([
      "Scope 1 is 50% higher than Q4 2025 (10.00 → 15.00 tCO₂e).",
    ]);
  });

  it("does not flag a change just under 50%", () => {
    const rows = [row({ scope1Tco2e: "14.9" }), previous()];
    expect(codesFor(rows)).not.toContain("jump_from_previous");
  });

  it("flags a fall, and says lower", () => {
    const rows = [row({ scope1Tco2e: "4.0000" }), previous()];
    expect(messagesFor(rows)).toEqual(["Scope 1 is 60% lower than Q4 2025 (10.00 → 4.00 tCO₂e)."]);
  });

  it("skips a scope whose previous figure is zero, since there is no percentage", () => {
    const rows = [row({ scope1Tco2e: "5.0000" }), previous({ scope1Tco2e: "0" })];
    expect(codesFor(rows)).not.toContain("jump_from_previous");
  });

  it("compares with the most recent earlier period, not an older or later one", () => {
    const rows = [
      row({ scope1Tco2e: "15.0000" }),
      previous({ id: "older", reportingPeriodLabel: "Q3 2025", dueDate: DUE("2025-10-31"), scope1Tco2e: "100.0000" }),
      previous(),
      previous({ id: "later", reportingPeriodLabel: "Q2 2026", dueDate: DUE("2026-07-31"), scope1Tco2e: "1000.0000" }),
    ];
    expect(messagesFor(rows)).toEqual(["Scope 1 is 50% higher than Q4 2025 (10.00 → 15.00 tCO₂e)."]);
  });

  it("ignores earlier requests that hold no figures to compare", () => {
    const rows = [
      row({ scope1Tco2e: "15.0000" }),
      previous({ status: "requested", scope1Tco2e: null, scope2Tco2e: null, scope3Tco2e: null }),
    ];
    expect(codesFor(rows)).not.toContain("jump_from_previous");
  });

  it("treats a rejected earlier request as having no figures to compare", () => {
    const rows = [row({ scope1Tco2e: "15.0000" }), previous({ status: "rejected" })];
    expect(codesFor(rows)).not.toContain("jump_from_previous");
  });

  it("matches the same subcontractor despite case and spacing, and never a different one", () => {
    const rows = [
      row({ scope1Tco2e: "15.0000" }),
      previous({ subcontractorName: "  acme   groundworks " }),
      previous({ id: "other", subcontractorName: "Other Ltd", scope1Tco2e: "1.0000" }),
    ];
    expect(messagesFor(rows)).toEqual(["Scope 1 is 50% higher than Q4 2025 (10.00 → 15.00 tCO₂e)."]);
  });

  it("reads a Decimal-shaped previous figure", () => {
    const decimal = (value: string) => ({ toString: () => value });
    const rows = [row({ scope1Tco2e: "15.0000" }), previous({ scope1Tco2e: decimal("10.0000") })];
    expect(codesFor(rows)).toContain("jump_from_previous");
  });
});
