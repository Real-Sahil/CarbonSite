import { EVIDENCE_TIER_LABEL, evidenceTier, tierReasons, type TierInput } from "@/lib/data-quality/evidence-tier";

const STYLE = {
  verified: "border-emerald-200 bg-emerald-50 text-emerald-800",
  partial: "border-amber-200 bg-amber-50 text-amber-800",
  estimated: "border-slate-200 bg-slate-50 text-slate-700",
} as const;

/** Verified / Partially verified / Estimated, with the reasons as a tooltip. */
export function EvidenceTierBadge({ record }: { record: TierInput }) {
  const tier = evidenceTier(record);
  const reasons = tierReasons(record);
  return (
    <span
      title={reasons.length ? reasons.join(". ") : "Primary data, evidence attached, approved in review"}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${STYLE[tier]}`}
    >
      {EVIDENCE_TIER_LABEL[tier]}
    </span>
  );
}
