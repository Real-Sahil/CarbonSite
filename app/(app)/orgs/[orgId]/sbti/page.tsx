export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { TrendingDown, Target, CheckCircle, AlertTriangle, Info } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS, AuthError } from "@/lib/auth/session";
import { loadSbtiPathway } from "@/lib/calculation/sbti-actuals";
import { SbtiSetTargetButton, STATUS_CONFIG, type SbtiTarget } from "./sbti-actions";

export default async function SbtiPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;

  let canEdit = false;
  try {
    const result = await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);
    canEdit = ["admin", "editor"].includes(result.membership.role);
  } catch (err) {
    if (err instanceof AuthError) redirect("/sign-in");
    throw err;
  }

  const [rawTarget, pathwayResult] = await Promise.all([
    prisma.sbtiTarget.findUnique({
      where: { organizationId: orgId },
      select: {
        pathway: true, baseYear: true,
        baselineScope1Tco2e: true, baselineScope2Tco2e: true, baselineScope3Tco2e: true,
        nearTermYear: true, nearTermReductionPct: true,
        netZeroYear: true, netZeroReductionPct: true,
        status: true, notes: true,
      },
    }),
    loadSbtiPathway(orgId),
  ]);

  const target: SbtiTarget | null = rawTarget
    ? {
        pathway: rawTarget.pathway,
        baseYear: rawTarget.baseYear,
        baselineScope1Tco2e: Number(rawTarget.baselineScope1Tco2e),
        baselineScope2Tco2e: Number(rawTarget.baselineScope2Tco2e),
        baselineScope3Tco2e: rawTarget.baselineScope3Tco2e != null ? Number(rawTarget.baselineScope3Tco2e) : null,
        nearTermYear: rawTarget.nearTermYear,
        nearTermReductionPct: Number(rawTarget.nearTermReductionPct),
        netZeroYear: rawTarget.netZeroYear,
        netZeroReductionPct: Number(rawTarget.netZeroReductionPct),
        status: rawTarget.status,
        notes: rawTarget.notes,
      }
    : null;

  const trajectory = pathwayResult?.trajectory ?? [];
  const alerts = pathwayResult?.alerts ?? [];

  const baseTotal = target
    ? target.baselineScope1Tco2e + target.baselineScope2Tco2e + (target.baselineScope3Tco2e ?? 0)
    : 0;
  const nearTermTarget = target ? baseTotal * (1 - target.nearTermReductionPct / 100) : 0;
  const netZeroTarget = target ? baseTotal * (1 - target.netZeroReductionPct / 100) : 0;

  const statusConfig = target ? (STATUS_CONFIG[target.status] ?? STATUS_CONFIG.draft) : null;

  const maxTco2e = trajectory.reduce(
    (m, p) => Math.max(m, p.expectedTco2e, p.actualTco2e ?? 0),
    0,
  );

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">SBTi Net-Zero Roadmap</h1>
          <p className="text-sm text-gray-500 mt-1">Science-Based Targets aligned with the 1.5°C pathway.</p>
        </div>
        {canEdit && <SbtiSetTargetButton orgId={orgId} existing={target} />}
      </div>

      {!target ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-[#FFF7ED] flex items-center justify-center">
            <TrendingDown className="h-5 w-5 text-[#f97316]" />
          </div>
          <p className="text-sm font-medium text-gray-700">No SBTi target set</p>
          <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
            Set a Science-Based Target to align your organisation with the 1.5°C Paris Agreement pathway.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            {statusConfig && (
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusConfig.cls}`}>
                {statusConfig.label}
              </span>
            )}
            <span className="rounded-full px-3 py-1 text-xs font-medium bg-[#FFF7ED] text-[#f97316]">
              {target.pathway} pathway
            </span>
            <span className="text-xs text-gray-500">Base year: {target.baseYear}</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Baseline (total)", value: baseTotal.toFixed(1), unit: "tCO2e" },
              { label: `Near-term target (${target.nearTermYear})`, value: nearTermTarget.toFixed(1), unit: `tCO2e (-${target.nearTermReductionPct.toFixed(0)}%)` },
              { label: `Net-zero target (${target.netZeroYear})`, value: netZeroTarget.toFixed(1), unit: `tCO2e (-${target.netZeroReductionPct.toFixed(0)}%)` },
              { label: "Annual reduction needed", value: ((baseTotal - nearTermTarget) / Math.max(target.nearTermYear - target.baseYear, 1)).toFixed(1), unit: "tCO2e/year" },
            ].map(({ label, value, unit }) => (
              <div key={label} className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-1 leading-tight">{label}</div>
                <div className="text-2xl font-semibold text-gray-900 tabular-nums">{value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{unit}</div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Baseline emissions by scope</h3>
            <div className="space-y-3">
              {[
                { label: "Scope 1 (Direct)", value: target.baselineScope1Tco2e, color: "bg-[#f97316]" },
                { label: "Scope 2 (Electricity)", value: target.baselineScope2Tco2e, color: "bg-emerald-500" },
                ...(target.baselineScope3Tco2e != null
                  ? [{ label: "Scope 3 (Value chain)", value: target.baselineScope3Tco2e, color: "bg-violet-500" }]
                  : []),
              ].map(({ label, value, color }) => {
                const pct = baseTotal > 0 ? (value / baseTotal) * 100 : 0;
                return (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-gray-700">{label}</span>
                      <span className="text-sm font-medium tabular-nums text-gray-900">
                        {value.toFixed(1)} tCO2e <span className="text-gray-500 font-normal">({pct.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {alerts.length > 0 && (
            <div className="space-y-2">
              {alerts.map((alert, i) => {
                const cls =
                  alert.severity === "critical"
                    ? "border-red-200 bg-red-50 text-red-800"
                    : alert.severity === "warning"
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-blue-200 bg-blue-50 text-blue-800";
                return (
                  <div key={i} className={`flex items-start gap-2 rounded-lg border px-4 py-2.5 text-xs ${cls}`}>
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <span>{alert.message}</span>
                  </div>
                );
              })}
            </div>
          )}

          {trajectory.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Reduction pathway: expected vs. actual</h3>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#f97316]" />Expected</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />On track</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400" />Behind</span>
                </div>
              </div>
              <div className="flex items-end gap-1.5 h-32 overflow-x-auto pb-2">
                {trajectory
                  .filter((_, i) => i % 2 === 0 || trajectory.length <= 20)
                  .map((point) => {
                    const expectedPct = maxTco2e > 0 ? (point.expectedTco2e / maxTco2e) * 100 : 0;
                    const actualPct = point.actualTco2e != null && maxTco2e > 0 ? (point.actualTco2e / maxTco2e) * 100 : null;
                    const isNearTerm = point.year === target.nearTermYear;
                    const isNetZero = point.year === target.netZeroYear;
                    const actualColor = point.status === "behind" ? "bg-red-400" : "bg-emerald-500";
                    return (
                      <div key={point.year} className="flex flex-col items-center gap-1 flex-shrink-0" style={{ minWidth: actualPct != null ? "36px" : "24px" }}>
                        <div className="flex items-end gap-0.5" style={{ height: "100%" }}>
                          <div className="w-4 rounded-t-sm bg-[#f97316] transition-all"
                            style={{ height: `${Math.max(expectedPct, 2)}%`, opacity: isNearTerm || isNetZero ? 1 : 0.7 }} />
                          {actualPct != null && (
                            <div className={`w-4 rounded-t-sm transition-all ${actualColor}`}
                              style={{ height: `${Math.max(actualPct, 2)}%` }} />
                          )}
                        </div>
                        <span className={`text-[9px] tabular-nums ${isNearTerm || isNetZero ? "text-[#f97316] font-semibold" : "text-gray-300"}`}>
                          {point.year}
                        </span>
                      </div>
                    );
                  })}
              </div>
              <div className="flex items-center gap-6 mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-xs text-gray-500">Near-term: {nearTermTarget.toFixed(0)} tCO2e by {target.nearTermYear}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Target className="h-3.5 w-3.5 text-[#f97316]" />
                  <span className="text-xs text-gray-500">Net-zero: {netZeroTarget.toFixed(0)} tCO2e by {target.netZeroYear}</span>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-[#FED7AA] bg-[#FFF7ED] p-5">
            <div className="flex items-start gap-3">
              <Info className="h-4 w-4 text-[#f97316] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-[#9A3412] mb-1">About SBTi alignment</p>
                <p className="text-xs text-[#7C3D12] leading-relaxed">
                  The 1.5°C pathway requires approximately 50% reduction in Scope 1+2 emissions by 2030 from a 2020 base year.
                  Net-zero targets require at least 90% reduction and the neutralisation of residual emissions.
                  Submit your targets to the Science Based Targets initiative for validation at sciencebasedtargets.org.
                </p>
                {target.status !== "validated" && (
                  <p className="text-xs text-amber-700 mt-2 font-medium">
                    <AlertTriangle className="inline h-3 w-3 mr-1" />
                    This target has not yet been validated by SBTi.
                  </p>
                )}
              </div>
            </div>
          </div>

          {target.notes && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4">
              <p className="text-xs font-medium text-gray-500 mb-1">Notes</p>
              <p className="text-sm text-gray-700">{target.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
