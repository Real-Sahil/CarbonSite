import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface TargetWithProgress {
  id: string;
  targetType: string;
  baselinePeriodLabel: string;
  baselineTonnes: number | null;
  targetPeriodLabel: string;
  currentTonnes: number | null;
  reductionAmountKg: number; // kgCO2e — from reductionTarget.reductionAmount
}

interface TargetProgressSectionProps {
  targets: TargetWithProgress[];
}

function formatTonnes(t: number): string {
  return t.toLocaleString("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function ProgressBar({ percent, color }: { percent: number; color: "green" | "amber" | "grey" }) {
  const clamped = Math.min(100, Math.max(0, percent));
  const trackClass = "h-2 w-full rounded-full bg-[#e5e7eb]";
  const fillClass =
    color === "green"
      ? "h-full rounded-full bg-emerald-600 transition-all"
      : color === "amber"
        ? "h-full rounded-full bg-amber-400 transition-all"
        : "h-full rounded-full bg-[#9ca3af] transition-all";
  return (
    <div className={trackClass}>
      <div className={fillClass} style={{ width: `${clamped}%` }} />
    </div>
  );
}

function TargetProgressCard({ target }: { target: TargetWithProgress }) {
  const reductionTargetTonnes = target.reductionAmountKg / 1000;

  // Determine progress
  let progressPercent: number | null = null;
  let reducedTonnes: number | null = null;

  if (target.baselineTonnes !== null && target.currentTonnes !== null) {
    reducedTonnes = target.baselineTonnes - target.currentTonnes;
    if (reductionTargetTonnes > 0) {
      progressPercent = (reducedTonnes / reductionTargetTonnes) * 100;
    }
  }

  const hasData = progressPercent !== null && reducedTonnes !== null;

  let color: "green" | "amber" | "grey" = "grey";
  if (hasData && progressPercent !== null) {
    if (progressPercent >= 100) color = "green";
    else if (progressPercent >= 50) color = "amber";
    else color = "grey";
  }

  // Target reduction as percentage of baseline (for display)
  const targetReductionPct =
    target.baselineTonnes && target.baselineTonnes > 0
      ? (reductionTargetTonnes / target.baselineTonnes) * 100
      : null;

  return (
    <div className="rounded-[10px] border border-[#E5E7EB] bg-white p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sm text-[#111827] capitalize">{target.targetType} target</span>
        {hasData && progressPercent !== null && (
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              color === "green"
                ? "bg-emerald-100 text-emerald-700"
                : color === "amber"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-[#f3f4f6] text-[#6b7280]"
            }`}
          >
            {Math.round(Math.max(0, progressPercent))}% achieved
          </span>
        )}
      </div>

      {/* Period columns */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-0.5">
          <p className="text-xs text-[#6b7280] tracking-[-0.3px]">Baseline</p>
          <p className="text-sm font-medium text-[#111827]">{target.baselinePeriodLabel}</p>
          <p className="text-sm text-[#374151]">
            {target.baselineTonnes !== null
              ? `${formatTonnes(target.baselineTonnes)} tCO₂e`
              : <span className="text-[#9ca3af] text-xs">No data</span>}
          </p>
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-xs text-[#6b7280] tracking-[-0.3px]">Target period</p>
          <p className="text-sm font-medium text-[#111827]">{target.targetPeriodLabel}</p>
          <p className="text-sm text-[#374151]">
            {target.currentTonnes !== null
              ? `${formatTonnes(target.currentTonnes)} tCO₂e`
              : <span className="text-[#9ca3af] text-xs">No data yet</span>}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      {hasData && progressPercent !== null && reducedTonnes !== null ? (
        <div className="flex flex-col gap-1.5">
          <ProgressBar percent={progressPercent} color={color} />
          <p className="text-xs text-[#6b7280] tracking-[-0.3px]">
            {reducedTonnes > 0
              ? `${formatTonnes(reducedTonnes)} tCO₂e reduced · ${Math.round(Math.max(0, progressPercent))}% of target achieved`
              : `No reduction recorded yet · target: reduce by ${formatTonnes(reductionTargetTonnes)} tCO₂e${targetReductionPct !== null ? ` (${Math.round(targetReductionPct)}%)` : ""}`}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="h-2 w-full rounded-full bg-[#e5e7eb]" />
          <p className="text-xs text-[#9ca3af] tracking-[-0.3px]">
            {target.baselineTonnes === null
              ? "No calculation data yet — run a calculation for the baseline period to see progress."
              : `No calculation data yet for the target period · target: reduce by ${formatTonnes(reductionTargetTonnes)} tCO₂e${targetReductionPct !== null ? ` (${Math.round(targetReductionPct)}%)` : ""}`}
          </p>
        </div>
      )}
    </div>
  );
}

export function TargetProgressSection({ targets }: TargetProgressSectionProps) {
  if (targets.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Progress overview</CardTitle>
        <CardDescription>
          How each target is tracking against baseline and current-period calculations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {targets.map((target) => (
            <TargetProgressCard key={target.id} target={target} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
