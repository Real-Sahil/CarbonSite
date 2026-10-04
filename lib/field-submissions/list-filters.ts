import type { FieldDocumentType, FieldSubmissionStatus } from "@prisma/client";

/** The review queue's status tabs, in order. `pending` (not yet sent) only shows under All. */
export const SUBMISSION_STATUSES = ["submitted", "under_review", "needs_info", "approved", "rejected"] as const;

export const DOCUMENT_TYPE_LABELS: Record<FieldDocumentType, string> = {
  waste_ticket: "Waste ticket",
  delivery_note: "Delivery note",
  fuel_receipt: "Fuel receipt",
  water_meter_reading: "Water meter reading",
  social_value: "Social value",
  hazard_report: "Hazard report",
  site_inspection: "Site inspection",
  other: "Other",
};

export const DOCUMENT_TYPES = Object.keys(DOCUMENT_TYPE_LABELS) as FieldDocumentType[];

const FILTER_KEYS = ["status", "documentType", "facilityId", "contractId", "periodId"] as const;
const ENUMS: Record<string, readonly string[]> = { status: SUBMISSION_STATUSES, documentType: DOCUMENT_TYPES };

/**
 * The submissions filters in a page's query string: only known keys, a fixed-list
 * value must be on its list, ids at most 64 characters. Anything else is dropped
 * rather than refused, so an old link still opens the page.
 */
export function parseSubmissionFilters(query: Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of FILTER_KEYS) {
    const v = query[key];
    if (typeof v !== "string" || !v || v.length > 64) continue;
    if (ENUMS[key] && !ENUMS[key].includes(v)) continue;
    out[key] = v;
  }
  return out;
}

/**
 * The Prisma where for the list, always inside the organisation. `withStatus` is
 * false for the tab counts, which count each status under the other filters.
 */
export function submissionWhere(orgId: string, filters: Record<string, string>, withStatus = true) {
  return {
    organizationId: orgId,
    ...(withStatus && filters.status ? { status: filters.status as FieldSubmissionStatus } : {}),
    ...(filters.documentType ? { documentType: filters.documentType as FieldDocumentType } : {}),
    ...(filters.facilityId ? { facilityId: filters.facilityId } : {}),
    ...(filters.contractId ? { contractId: filters.contractId } : {}),
    ...(filters.periodId ? { reportingPeriodId: filters.periodId } : {}),
  };
}
