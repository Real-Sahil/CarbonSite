import type { DataOrigin } from "@prisma/client";
import { DATA_ORIGIN_META } from "@/lib/inventory/provenance";

/**
 * One label for how far a figure can be checked:
 * - verified: primary data (metered, invoiced, supplier specific, calculated
 *   from measured values), source evidence attached, approved in review.
 * - partial: primary data missing one of those, or secondary data that was
 *   reviewed with evidence.
 * - estimated: estimates, proxies and extrapolations, or primary data with
 *   neither evidence nor approval.
 */
export type EvidenceTier = "verified" | "partial" | "estimated";

export const EVIDENCE_TIER_LABEL: Record<EvidenceTier, string> = {
  verified: "Verified",
  partial: "Partially verified",
  estimated: "Estimated",
};

export const EVIDENCE_TIER_ORDER: EvidenceTier[] = ["verified", "partial", "estimated"];

export type TierInput = { dataOrigin: DataOrigin; evidenceStatus: string; reviewStatus: string };

export function evidenceTier(r: TierInput): EvidenceTier {
  const primary = DATA_ORIGIN_META[r.dataOrigin]?.isPrimary ?? false;
  const approved = r.reviewStatus === "approved";
  const evidenced = r.evidenceStatus === "complete";
  const someEvidence = r.evidenceStatus !== "missing";
  if (primary && approved && evidenced) return "verified";
  if (primary && (approved || someEvidence)) return "partial";
  if (!primary && approved && evidenced) return "partial";
  return "estimated";
}

/** Why a record sits in its tier, in the order a reviewer would fix it. */
export function tierReasons(r: TierInput): string[] {
  const out: string[] = [];
  if (!(DATA_ORIGIN_META[r.dataOrigin]?.isPrimary ?? false)) out.push(`Data origin: ${DATA_ORIGIN_META[r.dataOrigin]?.label ?? r.dataOrigin}`);
  if (r.evidenceStatus !== "complete") out.push(r.evidenceStatus === "partial" ? "Evidence partly attached" : "No evidence attached");
  if (r.reviewStatus !== "approved") out.push("Not approved in review");
  return out;
}

export type TierSplit = Record<EvidenceTier, { records: number; co2e: number; percent: number }>;

/** Emissions-weighted split by tier (a metered gas supply outweighs many small estimates). */
/** Rows may be pre-grouped: `count` says how many records a row stands for (default 1). */
export function summariseTiers(rows: Array<TierInput & { totalCo2e: number; count?: number }>): TierSplit {
  const split = Object.fromEntries(EVIDENCE_TIER_ORDER.map((t) => [t, { records: 0, co2e: 0, percent: 0 }])) as TierSplit;
  let total = 0;
  for (const r of rows) {
    const t = evidenceTier(r);
    const kg = Number.isFinite(r.totalCo2e) ? r.totalCo2e : 0;
    split[t].records += r.count ?? 1;
    split[t].co2e += kg;
    total += kg;
  }
  for (const t of EVIDENCE_TIER_ORDER) split[t].percent = total > 0 ? (split[t].co2e / total) * 100 : 0;
  return split;
}
