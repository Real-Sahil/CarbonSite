import type { CalculationRunStatus } from "@prisma/client";

export const RUN_STATUSES = ["queued", "running", "succeeded", "failed"] as const;

export const RUN_STATUS_LABELS: Record<(typeof RUN_STATUSES)[number], string> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
};

const KEYS = ["status", "periodId", "factorLibraryId"] as const;

/**
 * The calculations list filters in a page's query string: known keys only, status
 * must be a run status, ids at most 64 characters. Anything else is dropped so an
 * old link still opens the page.
 */
export function parseRunFilters(query: Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of KEYS) {
    const v = query[key];
    if (typeof v !== "string" || !v || v.length > 64) continue;
    if (key === "status" && !(RUN_STATUSES as readonly string[]).includes(v)) continue;
    out[key] = v;
  }
  return out;
}

/** The Prisma where for the runs list, always inside the organisation. */
export function runWhere(orgId: string, filters: Record<string, string>) {
  return {
    organizationId: orgId,
    ...(filters.status ? { status: filters.status as CalculationRunStatus } : {}),
    ...(filters.periodId ? { reportingPeriodId: filters.periodId } : {}),
    ...(filters.factorLibraryId ? { factorLibraryId: filters.factorLibraryId } : {}),
  };
}
