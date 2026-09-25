/**
 * Matches a bill or receipt that has been read (bill-extractor output) to the
 * activity records it evidences, so an organisation that imported its figures
 * first can attach the source documents afterwards. Deterministic: a record
 * is a candidate only when the quantity agrees (after unit conversion);
 * supplier, dates and category then raise the score. The person confirms
 * every attachment.
 */
import { prisma } from "@/lib/db";
import { convertBetween } from "@/lib/calculation/units";
import type { BillExtraction } from "./bill-extractor";

export type MatchableRecord = {
  id: string;
  amount: number;
  unit: string;
  activityDate: Date | null;
  startDate: Date | null;
  endDate: Date | null;
  supplierName: string | null;
  categoryCode: string;
  sourceDescription: string | null;
  evidenceStatus: string;
};

export type RecordMatch = { recordId: string; score: number; reasons: string[] };

/** A match this strong can be attached in bulk without picking. */
export const CONFIDENT_MATCH = 80;

const DAY = 86_400_000;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function sameQuantity(billAmount: number, billUnit: string, record: MatchableRecord): { diff: number } | null {
  const converted = norm(billUnit) === norm(record.unit) ? billAmount : convertBetween(billAmount, billUnit, record.unit);
  if (converted == null || !(record.amount > 0)) return null;
  return { diff: Math.abs(converted - record.amount) / record.amount };
}

/** Scores one record against a read bill, or null when the quantity does not agree. */
export function scoreRecordMatch(bill: BillExtraction, record: MatchableRecord): RecordMatch | null {
  if (!bill.unit) return null;
  const quantities = [bill.amount?.value, ...bill.alternatives].filter((v): v is number => typeof v === "number" && v > 0);
  let best: { diff: number; primary: boolean } | null = null;
  quantities.forEach((q, i) => {
    const r = sameQuantity(q, bill.unit!, record);
    if (r && r.diff <= 0.02 && (!best || r.diff < best.diff)) best = { diff: r.diff, primary: i === 0 };
  });
  if (!best) return null;
  const found = best as { diff: number; primary: boolean };

  const reasons: string[] = [];
  let score = found.diff <= 0.001 ? 50 : 40;
  reasons.push(found.diff <= 0.001 ? "Same quantity" : `Quantity within ${(found.diff * 100).toFixed(1)}%`);
  if (!found.primary) {
    score -= 10;
    reasons.push("Quantity is not the one read as consumption");
  }

  const supplier = bill.supplier?.value;
  if (supplier && record.supplierName) {
    const a = norm(supplier);
    const b = norm(record.supplierName);
    if (a && b && (a.includes(b) || b.includes(a))) {
      score += 20;
      reasons.push("Same supplier");
    }
  }

  const billStart = bill.periodStart ? Date.parse(bill.periodStart.value) : null;
  const billEnd = bill.periodEnd ? Date.parse(bill.periodEnd.value) : bill.issueDate ? Date.parse(bill.issueDate.value) : null;
  const recStart = (record.startDate ?? record.activityDate)?.getTime() ?? null;
  const recEnd = (record.endDate ?? record.activityDate)?.getTime() ?? null;
  if (billStart != null && billEnd != null && recStart != null && recEnd != null && recStart <= billEnd + 3 * DAY && recEnd >= billStart - 3 * DAY) {
    score += 20;
    reasons.push("Dates overlap the billing period");
  } else if (billEnd != null && recEnd != null && Math.abs(recEnd - billEnd) <= 45 * DAY) {
    score += 10;
    reasons.push("Dated within 45 days of the bill");
  }

  if (bill.categoryCode && bill.categoryCode === record.categoryCode) {
    score += 10;
    reasons.push("Same category");
  }
  return { recordId: record.id, score: Math.min(100, score), reasons };
}

/** Best candidates first; records that already have evidence rank lower. */
export function rankMatches(bill: BillExtraction, records: MatchableRecord[], limit = 5): RecordMatch[] {
  return records
    .map((r) => {
      const m = scoreRecordMatch(bill, r);
      if (!m) return null;
      return r.evidenceStatus === "complete" ? { ...m, score: m.score - 15, reasons: [...m.reasons, "Already has evidence"] } : m;
    })
    .filter((m): m is RecordMatch => m != null && m.score >= 50)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Loads the org's records a read bill could evidence (same category when the
 * bill's kind is known, dated near the bill when it has a date, not already
 * carrying this file) and ranks them.
 */
export async function findRecordMatches(orgId: string, evidenceId: string, bill: BillExtraction) {
  const billDate = bill.periodEnd?.value ?? bill.issueDate?.value ?? null;
  const around = billDate ? Date.parse(billDate) : null;
  const rows = await prisma.activityRecord.findMany({
    where: {
      organizationId: orgId,
      ...(bill.categoryCode ? { emissionCategory: { code: bill.categoryCode } } : {}),
      ...(around != null
        ? {
            OR: [
              { activityDate: { gte: new Date(around - 400 * DAY), lte: new Date(around + 120 * DAY) } },
              { endDate: { gte: new Date(around - 400 * DAY), lte: new Date(around + 120 * DAY) } },
            ],
          }
        : {}),
      evidence: { none: { evidenceFileId: evidenceId } },
    },
    select: {
      id: true,
      amount: true,
      unit: true,
      activityDate: true,
      startDate: true,
      endDate: true,
      supplierName: true,
      sourceDescription: true,
      evidenceStatus: true,
      emissionCategory: { select: { code: true, name: true, scope: true } },
      facility: { select: { name: true } },
    },
    orderBy: { activityDate: "desc" },
    take: 2000,
  });
  const records = rows.map((r) => ({
    id: r.id,
    amount: Number(r.amount),
    unit: r.unit,
    activityDate: r.activityDate,
    startDate: r.startDate,
    endDate: r.endDate,
    supplierName: r.supplierName,
    categoryCode: r.emissionCategory.code,
    sourceDescription: r.sourceDescription,
    evidenceStatus: r.evidenceStatus,
  }));
  const byId = new Map(rows.map((r) => [r.id, r]));
  return rankMatches(bill, records).map((m) => {
    const r = byId.get(m.recordId)!;
    return {
      ...m,
      record: {
        id: r.id,
        amount: Number(r.amount),
        unit: r.unit,
        date: (r.endDate ?? r.activityDate)?.toISOString().slice(0, 10) ?? null,
        supplierName: r.supplierName,
        description: r.sourceDescription,
        category: `Scope ${r.emissionCategory.scope}: ${r.emissionCategory.name}`,
        facility: r.facility?.name ?? null,
        hasEvidence: r.evidenceStatus === "complete",
      },
    };
  });
}
