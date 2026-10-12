/**
 * Checks shown on the verify screen for a submitted subcontractor request. They
 * are warnings only: the verifier decides, so nothing here blocks a verify.
 *
 * Pure on purpose. No database import, so the rules run the same on the server
 * and in tests. The contract page computes them and passes the messages down.
 */
import type { SubcontractorSubmissionStatus } from "@prisma/client";

/** A figure this far above or below the previous period is flagged (50%). */
export const CHANGE_THRESHOLD = 0.5;

/** Decimal scopes arrive as Prisma Decimals, strings or numbers. */
export type Figure = { toString(): string } | string | number | null;

/** The fields the checks read. Extra fields on a Prisma row are fine. */
export type CheckRow = {
  id: string;
  subcontractorName: string;
  reportingPeriodLabel: string;
  dueDate: Date;
  status: SubcontractorSubmissionStatus;
  scope1Tco2e: Figure;
  scope2Tco2e: Figure;
  scope3Tco2e: Figure;
  evidenceStorageKey: string | null;
};

export type CheckCode = "negative" | "all_zero" | "no_evidence" | "jump_from_previous";

export type SubmissionWarning = { code: CheckCode; message: string };

const SCOPES: { label: string; key: "scope1Tco2e" | "scope2Tco2e" | "scope3Tco2e" }[] = [
  { label: "Scope 1", key: "scope1Tco2e" },
  { label: "Scope 2", key: "scope2Tco2e" },
  { label: "Scope 3", key: "scope3Tco2e" },
];

function figure(value: Figure | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(typeof value === "object" ? value.toString() : value);
  return Number.isFinite(n) ? n : null;
}

function tonnes(value: number): string {
  return value.toFixed(2);
}

/** Names are free text, so "Acme Ltd" and "acme  ltd" are the same subcontractor. */
function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Checks on the row alone. */
function ownWarnings(row: CheckRow): SubmissionWarning[] {
  const warnings: SubmissionWarning[] = [];
  const entered: number[] = [];

  for (const { label, key } of SCOPES) {
    const value = figure(row[key]);
    if (value === null) continue;
    entered.push(value);
    if (value < 0) {
      warnings.push({
        code: "negative",
        message: `${label} is negative (${tonnes(value)} tCO₂e). Check the sign with the subcontractor before verifying.`,
      });
    }
  }

  // The request has no stored total, so "do not add up" becomes the one thing the
  // three scopes can show on their own: every figure entered is zero.
  if (entered.length > 0 && entered.every((value) => value === 0)) {
    warnings.push({
      code: "all_zero",
      message: "Every scope entered is zero. Confirm nothing was emitted this period, or ask for the figures again.",
    });
  }

  if (row.evidenceStorageKey === null) {
    warnings.push({ code: "no_evidence", message: "No evidence file attached. You can still verify." });
  }

  return warnings;
}

/**
 * The most recent earlier request for the same subcontractor that holds figures:
 * submitted or verified. Requests still owed, or sent back, have nothing to compare.
 */
function previousWith(row: CheckRow, sameSubcontractor: CheckRow[]): CheckRow | undefined {
  return sameSubcontractor
    .filter(
      (other) =>
        other.id !== row.id &&
        other.dueDate < row.dueDate &&
        (other.status === "submitted" || other.status === "verified"),
    )
    .sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime())[0];
}

/** Scope-by-scope change against the previous period. A zero base has no percentage, so it is skipped. */
function jumpWarnings(row: CheckRow, previous: CheckRow): SubmissionWarning[] {
  const warnings: SubmissionWarning[] = [];
  for (const { label, key } of SCOPES) {
    const current = figure(row[key]);
    const before = figure(previous[key]);
    if (current === null || before === null || before === 0) continue;

    const change = (current - before) / before;
    if (Math.abs(change) < CHANGE_THRESHOLD) continue;

    const percent = Math.round(Math.abs(change) * 100);
    warnings.push({
      code: "jump_from_previous",
      message: `${label} is ${percent}% ${change > 0 ? "higher" : "lower"} than ${previous.reportingPeriodLabel} (${tonnes(before)} → ${tonnes(current)} tCO₂e).`,
    });
  }
  return warnings;
}

/**
 * Warnings for each submitted request on a contract, keyed by request id. Other
 * statuses get no entry: the verify screen only asks about submitted figures.
 */
export function checkSubmissions(rows: CheckRow[]): Map<string, SubmissionWarning[]> {
  const byName = new Map<string, CheckRow[]>();
  for (const row of rows) {
    const key = nameKey(row.subcontractorName);
    byName.set(key, [...(byName.get(key) ?? []), row]);
  }

  const result = new Map<string, SubmissionWarning[]>();
  for (const row of rows) {
    if (row.status !== "submitted") continue;

    const previous = previousWith(row, byName.get(nameKey(row.subcontractorName)) ?? []);
    result.set(row.id, [...ownWarnings(row), ...(previous ? jumpWarnings(row, previous) : [])]);
  }
  return result;
}
