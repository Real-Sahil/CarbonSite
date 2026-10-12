import type { SubcontractorSubmissionStatus } from "@prisma/client";
import { OPEN_STATUSES } from "./portal";
import { isPastDue } from "./deadline";

/** The fields the summary reads. Decimal scopes arrive as Prisma Decimals, strings or numbers. */
export type SummaryRow = {
  status: SubcontractorSubmissionStatus;
  dueDate: Date;
  linkSentAt: Date | null;
  openedAt: Date | null;
  scope1Tco2e: { toString(): string } | string | number | null;
  scope2Tco2e: { toString(): string } | string | number | null;
  scope3Tco2e: { toString(): string } | string | number | null;
};

export type SubcontractorSummary = {
  /** Every request on the contract. */
  total: number;
  /** Requests still waiting for the subcontractor's figures (requested, overdue or sent back). */
  owed: number;
  /** Owed requests whose due day has passed. */
  overdue: number;
  /** Owed requests whose link went out and was never opened. */
  notOpened: number;
  /** Figures received and waiting for the team to verify or reject them. */
  awaitingReview: number;
  verified: number;
  /** Sum of the scopes entered on verified requests. It is what they reported, not a tested inventory. */
  verifiedTco2e: number;
};

function toNumber(value: SummaryRow["scope1Tco2e"]): number {
  if (value === null) return 0;
  const n = Number(typeof value === "object" ? value.toString() : value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Counts for the contract's summary strip. A request is overdue on the day after
 * its due date, as the list does, so the strip and the rows agree.
 */
export function subcontractorSummary(rows: SummaryRow[], now: Date): SubcontractorSummary {
  const summary: SubcontractorSummary = {
    total: rows.length,
    owed: 0,
    overdue: 0,
    notOpened: 0,
    awaitingReview: 0,
    verified: 0,
    verifiedTco2e: 0,
  };
  let verifiedTotal = 0;

  for (const row of rows) {
    if (row.status === "verified") {
      summary.verified++;
      verifiedTotal += toNumber(row.scope1Tco2e) + toNumber(row.scope2Tco2e) + toNumber(row.scope3Tco2e);
      continue;
    }
    if (row.status === "submitted") {
      summary.awaitingReview++;
      continue;
    }
    if (!OPEN_STATUSES.includes(row.status)) continue;

    summary.owed++;
    if (row.status === "overdue" || isPastDue(row.dueDate, now)) summary.overdue++;
    if (row.linkSentAt && !row.openedAt) summary.notOpened++;
  }

  summary.verifiedTco2e = Math.round(verifiedTotal * 10_000) / 10_000;
  return summary;
}
