/**
 * Planning obligations (Section 106 and conditions): what a site must deliver,
 * by when, and whether it is on track. Pure logic; the loader reads the data.
 */

export const OBLIGATION_KINDS = ["employment_skills", "local_procurement", "financial", "community", "other"] as const;
export const OBLIGATION_STATUSES = ["open", "met", "waived"] as const;
export type ObligationKind = (typeof OBLIGATION_KINDS)[number];
export type ObligationStatus = (typeof OBLIGATION_STATUSES)[number];

/** Days before the due date at which an open obligation starts to show as due soon. */
export const DUE_SOON_DAYS = 60;

export type ObligationState = "met" | "waived" | "overdue" | "due_soon" | "open";

export function obligationState(
  o: { status: string; dueDate: Date | null },
  today: Date = new Date(),
): ObligationState {
  if (o.status === "met") return "met";
  if (o.status === "waived") return "waived";
  if (!o.dueDate) return "open";
  const day = 86_400_000;
  const left = Math.floor((o.dueDate.getTime() - Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) / day);
  if (left < 0) return "overdue";
  return left <= DUE_SOON_DAYS ? "due_soon" : "open";
}

/**
 * Delivery against the target, from the linked commitment's approved activities.
 * Only quantities in the target's unit count; others are reported as a mismatch
 * instead of being added in.
 */
export function obligationProgress(
  target: { value: number | null; unit: string | null },
  delivered: { unit: string | null; quantity: number }[],
): { delivered: number; pct: number | null; unitMismatch: boolean } {
  const unit = target.unit?.trim().toLowerCase() ?? "";
  let sum = 0;
  let mismatch = false;
  for (const d of delivered) {
    if ((d.unit?.trim().toLowerCase() ?? "") === unit) sum += d.quantity;
    else mismatch = true;
  }
  const pct = target.value && target.value > 0 ? Math.round((sum / target.value) * 1000) / 10 : null;
  return { delivered: sum, pct, unitMismatch: mismatch };
}
