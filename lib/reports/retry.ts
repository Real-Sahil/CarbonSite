// Retry policy for report rendering. A report renders inside the request that
// asked for it (JOB_PROCESSING_MODE=inline, maxDuration 60). A function timeout
// or a kill leaves the report in "queued" or "generating" with nothing left to
// finish it. The reports sweep finds such reports once they have been quiet for
// REPORT_STALE_MS and renders them again, up to MAX_REPORT_ATTEMPTS starts.
// A render that throws still fails straight away: a rendering error does not
// fix itself on a second start.

/** Starts allowed per report, the first one included (CLAUDE.md: 3 attempts). */
export const MAX_REPORT_ATTEMPTS = 3;

/**
 * How long a queued or generating report may go without a write before it
 * counts as stalled. Longer than the 60 s request budget, so a live render is
 * never reclaimed.
 */
export const REPORT_STALE_MS = 5 * 60_000;

export type ReportSweepDecision = "skip" | "retry" | "fail";

export function reportAttemptsExhausted(processingAttempts: number): boolean {
  return processingAttempts >= MAX_REPORT_ATTEMPTS;
}

/** What the sweep does with one report it found unfinished. */
export function decideStalledReport(
  report: { status: string; processingAttempts: number; updatedAt: Date },
  now: Date,
): ReportSweepDecision {
  if (report.status !== "queued" && report.status !== "generating") return "skip";
  if (now.getTime() - report.updatedAt.getTime() < REPORT_STALE_MS) return "skip";
  return reportAttemptsExhausted(report.processingAttempts) ? "fail" : "retry";
}
