"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TrendingDown, Target, CheckCircle, AlertTriangle, X, Info } from "lucide-react";

interface SbtiTarget {
  id: string;
  pathway: string;
  baseYear: number;
  baselineScope1Tco2e: string;
  baselineScope2Tco2e: string;
  baselineScope3Tco2e: string | null;
  nearTermYear: number;
  nearTermReductionPct: string;
  netZeroYear: number;
  netZeroReductionPct: string;
  status: string;
  notes: string | null;
}

interface TrajectoryPoint { year: number; targetTco2e: number; pathway: string }

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  draft:      { label: "Draft",      cls: "bg-gray-100 text-gray-600" },
  committed:  { label: "Committed",  cls: "bg-blue-100 text-blue-700" },
  validated:  { label: "Validated",  cls: "bg-green-100 text-green-700" },
};

function SetTargetModal({ orgId, existing, onClose, onSaved }: {
  orgId: string; existing: SbtiTarget | null; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    pathway: existing?.pathway ?? "1.5C",
    baseYear: (existing?.baseYear ?? new Date().getFullYear() - 1).toString(),
    baselineScope1Tco2e: existing ? Number(existing.baselineScope1Tco2e).toString() : "",
    baselineScope2Tco2e: existing ? Number(existing.baselineScope2Tco2e).toString() : "",
    baselineScope3Tco2e: existing?.baselineScope3Tco2e ? Number(existing.baselineScope3Tco2e).toString() : "",
    nearTermYear: (existing?.nearTermYear ?? 2030).toString(),
    nearTermReductionPct: existing ? Number(existing.nearTermReductionPct).toString() : "50",
    netZeroYear: (existing?.netZeroYear ?? 2050).toString(),
    netZeroReductionPct: existing ? Number(existing.netZeroReductionPct).toString() : "90",
    status: existing?.status ?? "draft",
    notes: existing?.notes ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/sbti`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pathway: form.pathway,
          baseYear: Number(form.baseYear),
          baselineScope1Tco2e: Number(form.baselineScope1Tco2e),
          baselineScope2Tco2e: Number(form.baselineScope2Tco2e),
          baselineScope3Tco2e: form.baselineScope3Tco2e ? Number(form.baselineScope3Tco2e) : undefined,
          nearTermYear: Number(form.nearTermYear),
          nearTermReductionPct: Number(form.nearTermReductionPct),
          netZeroYear: Number(form.netZeroYear),
          netZeroReductionPct: Number(form.netZeroReductionPct),
          status: form.status,
          notes: form.notes || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.message ?? "Could not save.");
        return;
      }
      onSaved();
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/15 disabled:opacity-50";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{existing ? "Edit" : "Set"} SBTi net-zero target</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Pathway</label>
              <select value={form.pathway} onChange={(e) => setForm((f) => ({ ...f, pathway: e.target.value }))} className={inputCls}>
                <option value="1.5C">1.5°C pathway</option>
                <option value="WB2C">Well-below 2°C</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Base year</label>
              <input type="number" required min={2000} max={2030} value={form.baseYear}
                onChange={(e) => setForm((f) => ({ ...f, baseYear: e.target.value }))} className={inputCls} />
            </div>
          </div>

          <div className="rounded-lg bg-[#F0F9FF] border border-[#BAE6FD] px-4 py-3">
            <p className="text-xs font-medium text-[#0EA5E9] mb-2">Baseline emissions (tCO2e)</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: "baselineScope1Tco2e", label: "Scope 1" },
                { key: "baselineScope2Tco2e", label: "Scope 2" },
                { key: "baselineScope3Tco2e", label: "Scope 3 (opt.)" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs text-[#0EA5E9] mb-1">{label}</label>
                  <input type="number" min={0} step="0.01" value={form[key as keyof typeof form]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    required={key !== "baselineScope3Tco2e"}
                    className="w-full rounded-lg border border-[#E5E7EB] bg-white px-2 py-1.5 text-sm text-[#111827] outline-none focus:border-[#0EA5E9] focus:ring-1 focus:ring-[#0EA5E9]/20" placeholder="0" />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Near-term target year</label>
              <input type="number" required min={2025} max={2040} value={form.nearTermYear}
                onChange={(e) => setForm((f) => ({ ...f, nearTermYear: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Near-term reduction (%)</label>
              <input type="number" required min={0} max={100} step="0.1" value={form.nearTermReductionPct}
                onChange={(e) => setForm((f) => ({ ...f, nearTermReductionPct: e.target.value }))} className={inputCls} placeholder="50" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Net-zero target year</label>
              <input type="number" required min={2040} max={2100} value={form.netZeroYear}
                onChange={(e) => setForm((f) => ({ ...f, netZeroYear: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Net-zero reduction (%)</label>
              <input type="number" required min={0} max={100} step="0.1" value={form.netZeroReductionPct}
                onChange={(e) => setForm((f) => ({ ...f, netZeroReductionPct: e.target.value }))} className={inputCls} placeholder="90" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className={inputCls}>
              <option value="draft">Draft</option>
              <option value="committed">Committed</option>
              <option value="validated">Validated (SBTi approved)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes <span className="text-gray-400">(optional)</span></label>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className={`${inputCls} resize-none`} placeholder="SBTi submission date, validation notes..." />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-[#0EA5E9] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0284C7] disabled:opacity-60 transition-colors">
            {loading ? "Saving..." : existing ? "Update target" : "Set SBTi target"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function SbtiPage() {
  const params = useParams<{ orgId: string }>();
  const orgId = params.orgId;
  const [target, setTarget] = useState<SbtiTarget | null>(null);
  const [trajectory, setTrajectory] = useState<TrajectoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  async function load() {
    const res = await fetch(`/api/orgs/${orgId}/sbti`);
    if (res.ok) {
      const d = await res.json();
      setTarget(d.target);
      setTrajectory(d.trajectory);
    }
    setLoading(false);
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [orgId]);

  const baseTotal = target
    ? Number(target.baselineScope1Tco2e) + Number(target.baselineScope2Tco2e) + Number(target.baselineScope3Tco2e ?? 0)
    : 0;
  const nearTermTarget = baseTotal * (1 - Number(target?.nearTermReductionPct ?? 0) / 100);
  const netZeroTarget = baseTotal * (1 - Number(target?.netZeroReductionPct ?? 90) / 100);

  const statusConfig = target ? STATUS_CONFIG[target.status] ?? STATUS_CONFIG.draft : null;

  // Simple sparkline: use trajectory to build a visual bar chart
  const maxTco2e = trajectory.reduce((m, p) => Math.max(m, p.targetTco2e), 0);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">SBTi Net-Zero Roadmap</h1>
          <p className="text-sm text-gray-500 mt-1">Science-Based Targets aligned with the 1.5°C pathway.</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#0EA5E9] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0284C7] transition-colors">
          <Target className="h-4 w-4" />
          {target ? "Edit target" : "Set SBTi target"}
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-gray-400">Loading...</div>
      ) : !target ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-[#F0F9FF] flex items-center justify-center">
            <TrendingDown className="h-5 w-5 text-[#0EA5E9]" />
          </div>
          <p className="text-sm font-medium text-gray-700">No SBTi target set</p>
          <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
            Set a Science-Based Target to align your organisation with the 1.5°C Paris Agreement pathway.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Status + pathway */}
          <div className="flex items-center gap-3">
            {statusConfig && (
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusConfig.cls}`}>
                {statusConfig.label}
              </span>
            )}
            <span className="rounded-full px-3 py-1 text-xs font-medium bg-[#F0F9FF] text-[#0EA5E9]">
              {target.pathway} pathway
            </span>
            <span className="text-xs text-gray-500">Base year: {target.baseYear}</span>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Baseline (total)", value: baseTotal.toFixed(1), unit: "tCO2e" },
              { label: `Near-term target (${target.nearTermYear})`, value: nearTermTarget.toFixed(1), unit: `tCO2e (-${Number(target.nearTermReductionPct).toFixed(0)}%)` },
              { label: `Net-zero target (${target.netZeroYear})`, value: netZeroTarget.toFixed(1), unit: `tCO2e (-${Number(target.netZeroReductionPct).toFixed(0)}%)` },
              { label: "Annual reduction needed", value: ((baseTotal - nearTermTarget) / Math.max(target.nearTermYear - target.baseYear, 1)).toFixed(1), unit: "tCO2e/year" },
            ].map(({ label, value, unit }) => (
              <div key={label} className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1 leading-tight">{label}</div>
                <div className="text-2xl font-semibold text-gray-900 tabular-nums">{value}</div>
                <div className="text-xs text-gray-400 mt-0.5">{unit}</div>
              </div>
            ))}
          </div>

          {/* Scope breakdown */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Baseline emissions by scope</h3>
            <div className="space-y-3">
              {[
                { label: "Scope 1 (Direct)", value: Number(target.baselineScope1Tco2e), color: "bg-[#0EA5E9]" },
                { label: "Scope 2 (Electricity)", value: Number(target.baselineScope2Tco2e), color: "bg-emerald-500" },
                ...(target.baselineScope3Tco2e
                  ? [{ label: "Scope 3 (Value chain)", value: Number(target.baselineScope3Tco2e), color: "bg-violet-500" }]
                  : []),
              ].map(({ label, value, color }) => {
                const pct = baseTotal > 0 ? (value / baseTotal) * 100 : 0;
                return (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-gray-700">{label}</span>
                      <span className="text-sm font-medium tabular-nums text-gray-900">
                        {value.toFixed(1)} tCO2e <span className="text-gray-400 font-normal">({pct.toFixed(0)}%)</span>
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

          {/* Trajectory chart */}
          {trajectory.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Reduction pathway trajectory</h3>
                <span className="text-xs text-gray-400">Target tCO2e by year</span>
              </div>
              <div className="flex items-end gap-1 h-32 overflow-x-auto pb-2">
                {trajectory.filter((_, i) => i % 2 === 0 || trajectory.length <= 20).map((point) => {
                  const heightPct = maxTco2e > 0 ? (point.targetTco2e / maxTco2e) * 100 : 0;
                  const isNearTerm = point.year === target.nearTermYear;
                  const isNetZero = point.year === target.netZeroYear;
                  return (
                    <div key={point.year} className="flex flex-col items-center gap-1 flex-shrink-0" style={{ minWidth: "24px" }}>
                      <div className="w-4 rounded-t-sm bg-[#0EA5E9] transition-all"
                        style={{ height: `${Math.max(heightPct, 2)}%`, opacity: isNearTerm || isNetZero ? 1 : 0.7 }} />
                      <span className={`text-[9px] tabular-nums ${isNearTerm || isNetZero ? "text-[#0EA5E9] font-semibold" : "text-gray-300"}`}>
                        {point.year}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-6 mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-6 rounded-full bg-[#0EA5E9]" />
                  <span className="text-xs text-gray-500">Target trajectory</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-xs text-gray-500">Near-term: {nearTermTarget.toFixed(0)} tCO2e by {target.nearTermYear}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Target className="h-3.5 w-3.5 text-[#0EA5E9]" />
                  <span className="text-xs text-gray-500">Net-zero: {netZeroTarget.toFixed(0)} tCO2e by {target.netZeroYear}</span>
                </div>
              </div>
            </div>
          )}

          {/* SBTi info box */}
          <div className="rounded-xl border border-[#BAE6FD] bg-[#F0F9FF] p-5">
            <div className="flex items-start gap-3">
              <Info className="h-4 w-4 text-[#0EA5E9] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-[#0369A1] mb-1">About SBTi alignment</p>
                <p className="text-xs text-[#0EA5E9] leading-relaxed">
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

      {showModal && (
        <SetTargetModal
          orgId={orgId} existing={target}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); setLoading(true); load(); }}
        />
      )}
    </div>
  );
}
