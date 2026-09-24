// Likely duplicate activity records: the same category, amount, unit, date and
// facility (and supplier, when both name one). Entering an invoice twice, or
// importing the same file a second time with different rows around it, would
// otherwise double that line in the inventory with nothing to say so.
// Records without an activity date are never matched: too loose to be useful.

import { prisma } from "@/lib/db";

export type DuplicateKeyInput = {
  emissionCategoryId?: string | null;
  amount?: number | string | { toString(): string } | null;
  unit?: string | null;
  activityDate?: Date | string | null;
  facilityId?: string | null;
  supplierName?: string | null;
};

const day = (d: Date | string) => (typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10));

/** A comparable key, or null when the record lacks what a match needs. */
export function duplicateKey(r: DuplicateKeyInput): string | null {
  if (!r.emissionCategoryId || r.amount == null || !r.unit || !r.activityDate) return null;
  const amount = Number(r.amount.toString());
  if (!Number.isFinite(amount)) return null;
  return [
    r.emissionCategoryId,
    amount.toFixed(6),
    r.unit.trim().toLowerCase(),
    day(r.activityDate),
    r.facilityId ?? "",
    (r.supplierName ?? "").trim().toLowerCase(),
  ].join("|");
}

/**
 * Existing records in the organisation that match any of the candidates,
 * keyed by duplicate key. One query, narrowed by the candidates' categories
 * and dates.
 */
export async function findExistingDuplicates(
  orgId: string,
  candidates: DuplicateKeyInput[],
): Promise<Map<string, string>> {
  const keyed = candidates.filter((c) => duplicateKey(c) !== null);
  if (keyed.length === 0) return new Map();
  const categories = [...new Set(keyed.map((c) => c.emissionCategoryId!))];
  const dates = [...new Set(keyed.map((c) => day(c.activityDate!)))].map((d) => new Date(`${d}T00:00:00.000Z`));
  const existing = await prisma.activityRecord.findMany({
    where: {
      organizationId: orgId,
      emissionCategoryId: { in: categories },
      activityDate: { in: dates },
      reviewStatus: { not: "rejected" },
    },
    select: { id: true, emissionCategoryId: true, amount: true, unit: true, activityDate: true, facilityId: true, supplierName: true },
  });
  const out = new Map<string, string>();
  for (const e of existing) {
    const k = duplicateKey(e);
    if (k && !out.has(k)) out.set(k, e.id);
  }
  return out;
}
