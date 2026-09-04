"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Target, Plus, AlertTriangle, CheckCircle, TrendingUp, X, Pencil, Gauge } from "lucide-react";
import { computeCarbonEvm } from "@/lib/project-carbon/evm";

interface Phase {
  id: string;
  name: string;
  budgetTco2e: string;
  actualTco2e: string;
  percentComplete: string;
  plannedCompletionDate: string | null;
  sortOrder: number;
  notes: string | null;
}

interface Budget {
  id: string;
  totalBudgetTco2e: string;
  floorAreaM2: string | null;
  contractValueGbp: string | null;
  notes: string | null;
  phases: Phase[];
}

const ALERT_THRESHOLDS = [
  { pct: 120, label: "Over budget", cls: "bg-red-100 text-red-700 border-red-200" },
  { pct: 100, label: "At budget", cls: "bg-orange-100 text-orange-700 border-orange-200" },
  { pct: 80, label: "Near limit", cls: "bg-amber-100 text-amber-700 border-amber-200" },
];

function alertLevel(actualTco2e: number, budgetTco2e: number) {
  if (budgetTco2e <= 0) return null;
  const pct = (actualTco2e / budgetTco2e) * 100;
  if (pct >= 120) return ALERT_THRESHOLDS[0];
  if (pct >= 100) return ALERT_THRESHOLDS[1];
  if (pct >= 80) return ALERT_THRESHOLDS[2];
  return null;
}

function ProgressBar({ actual, budget }: { actual: number; budget: number }) {
  const pct = budget > 0 ? Math.min((actual / budget) * 100, 130) : 0;
  const color = pct >= 120 ? "bg-red-500" : pct >= 100 ? "bg-orange-500" : pct >= 80 ? "bg-amber-400" : "bg-[#f97316]";
  return (
    <div className="relative h-2.5 rounded-full bg-gray-100 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      {pct > 100 && (
        <div className="absolute inset-y-0 right-0 w-1 bg-red-600 rounded-r-full" />
      )}
    </div>
  );
}

function SetBudgetModal({
  orgId, contractId, projectId, existing, onClose, onSaved,
}: {
  orgId: string; contractId: string; projectId: string;
  existing: Budget | null; onClose: () => void; onSaved: () => void;
}) {
  const [totalBudget, setTotalBudget] = useState(existing ? Number(existing.totalBudgetTco2e).toString() : "");
  const [floorArea, setFloorArea] = useState(existing?.floorAreaM2 ? Number(existing.floorAreaM2).toString() : "");
  const [contractValue, setContractValue] = useState(existing?.contractValueGbp ? Number(existing.contractValueGbp).toString() : "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [phases, setPhases] = useState<Array<{ name: string; budgetTco2e: string; notes: string }>>(
    existing?.phases.map((p) => ({ name: p.name, budgetTco2e: Number(p.budgetTco2e).toString(), notes: p.notes ?? "" })) ??
    [
      { name: "Pre-construction / Design", budgetTco2e: "", notes: "" },
      { name: "Construction", budgetTco2e: "", notes: "" },
      { name: "Fit-out / Handover", budgetTco2e: "", notes: "" },
    ]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = {
        totalBudgetTco2e: Number(totalBudget),
        floorAreaM2: floorArea ? Number(floorArea) : undefined,
        contractValueGbp: contractValue ? Number(contractValue) : undefined,
        notes: notes || undefined,
        phases: phases.filter((p) => p.budgetTco2e).map((p, i) => ({
          name: p.name,
          budgetTco2e: Number(p.budgetTco2e),
          sortOrder: i,
          notes: p.notes || undefined,
        })),
      };
      const url = `/api/orgs/${orgId}/contracts/${contractId}/projects/${projectId}/carbon-budget`;
      const res = await fetch(url, {
        method: existing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.message ?? "Could not save budget.");
        return;
      }
      onSaved();
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#f97316] focus:ring-2 focus:ring-[#f97316]/15 disabled:opacity-50";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{existing ? "Edit" : "Set"} carbon budget</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Total carbon budget (tCO2e) <span className="text-red-500">*</span>
            </label>
            <input type="number" required min="0.01" step="0.01" value={totalBudget}
              onChange={(e) => setTotalBudget(e.target.value)} className={inputCls} placeholder="500.00" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Floor area (m2) <span className="text-gray-400">(optional)</span></label>
              <input type="number" min="0" step="0.1" value={floorArea}
                onChange={(e) => setFloorArea(e.target.value)} className={inputCls} placeholder="5000" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Contract value (GBP) <span className="text-gray-400">(optional)</span></label>
              <input type="number" min="0" step="1000" value={contractValue}
                onChange={(e) => setContractValue(e.target.value)} className={inputCls} placeholder="2000000" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-600">Budget by phase</p>
              <button type="button" onClick={() => setPhases([...phases, { name: "", budgetTco2e: "", notes: "" }])}
                className="text-xs text-[#f97316] hover:text-[#f97316] font-medium">+ Add phase</button>
            </div>
            <div className="space-y-2">
              {phases.map((phase, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input type="text" value={phase.name} placeholder="Phase name"
                    onChange={(e) => setPhases(phases.map((p, j) => j === i ? { ...p, name: e.target.value } : p))}
                    className={`${inputCls} flex-1`} />
                  <input type="number" min="0" step="0.01" value={phase.budgetTco2e} placeholder="tCO2e"
                    onChange={(e) => setPhases(phases.map((p, j) => j === i ? { ...p, budgetTco2e: e.target.value } : p))}
                    className="w-28 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#f97316] focus:ring-2 focus:ring-[#f97316]/15" />
                  <button type="button" onClick={() => setPhases(phases.filter((_, j) => j !== i))}
                    className="h-8 w-8 rounded-lg hover:bg-red-50 flex items-center justify-center flex-shrink-0">
                    <X className="h-3.5 w-3.5 text-gray-300 hover:text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes <span className="text-gray-400">(optional)</span></label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
              className={`${inputCls} resize-none`} placeholder="Budget basis, assumptions..." />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-[#f97316] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#ea580c] disabled:opacity-60 transition-colors">
            {loading ? "Saving..." : existing ? "Update budget" : "Set budget"}
          </button>
        </form>
      </div>
    </div>
  );
}

function PhaseRow({
  orgId, contractId, projectId, phase, onUpdated,
}: {
  orgId: string; contractId: string; projectId: string;
  phase: Phase; onUpdated: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [actual, setActual] = useState(phase.actualTco2e);
  const [percent, setPercent] = useState(phase.percentComplete);
  const [plannedDate, setPlannedDate] = useState(phase.plannedCompletionDate?.slice(0, 10) ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const phaseBudget = Number(phase.budgetTco2e);
  const phaseActual = Number(phase.actualTco2e);
  const phasePct = phaseBudget > 0 ? Math.round((phaseActual / phaseBudget) * 100) : 0;
  const phaseAlert = alertLevel(phaseActual, phaseBudget);

  async function handleSave() {
    setError("");
    setSaving(true);
    try {
      const res = await fetch(
        `/api/orgs/${orgId}/contracts/${contractId}/projects/${projectId}/carbon-budget/phases/${phase.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actualTco2e: Number(actual),
            percentComplete: Number(percent),
            plannedCompletionDate: plannedDate ? plannedDate : null,
          }),
        },
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.message ?? "Could not update phase progress.");
        return;
      }
      setEditing(false);
      onUpdated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-6 py-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{phase.name}</span>
          {phaseAlert && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${phaseAlert.cls}`}>
              {phaseAlert.label}
            </span>
          )}
          {!phaseAlert && phaseActual === 0 && (
            <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
              Not started
            </span>
          )}
          <span className="text-xs text-gray-400">{Number(phase.percentComplete).toFixed(0)}% complete</span>
          {phase.plannedCompletionDate && (
            <span className="text-xs text-gray-400">
              Planned {new Date(phase.plannedCompletionDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 tabular-nums">
            {phaseActual.toFixed(1)} / {phaseBudget.toFixed(1)} tCO2e ({phasePct}%)
          </span>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs font-medium text-[#f97316] hover:text-[#ea580c]"
            >
              Update
            </button>
          )}
        </div>
      </div>
      <ProgressBar actual={phaseActual} budget={phaseBudget} />

      {editing && (
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg bg-gray-50 p-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Actual (tCO2e)</label>
            <input
              type="number" min="0" step="0.01" value={actual}
              onChange={(e) => setActual(e.target.value)}
              className="w-28 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-[#f97316] focus:ring-2 focus:ring-[#f97316]/15"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Percent complete</label>
            <input
              type="number" min="0" max="100" step="1" value={percent}
              onChange={(e) => setPercent(e.target.value)}
              className="w-24 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-[#f97316] focus:ring-2 focus:ring-[#f97316]/15"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Planned completion</label>
            <input
              type="date" value={plannedDate}
              onChange={(e) => setPlannedDate(e.target.value)}
              className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-[#f97316] focus:ring-2 focus:ring-[#f97316]/15"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-[#f97316] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#ea580c] disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          {error && <p className="w-full text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}

function CarbonEvmCard({ phases }: { phases: Phase[] }) {
  const evm = computeCarbonEvm(
    phases.map((p) => ({
      budgetTco2e: Number(p.budgetTco2e),
      actualTco2e: Number(p.actualTco2e),
      percentComplete: Number(p.percentComplete),
    })),
  );

  const cpiLabel = evm.cpi == null ? "Not yet available" : evm.cpi.toFixed(2);
  const cpiTone = evm.cpi == null ? "text-gray-400" : evm.cpi >= 1 ? "text-green-700" : "text-red-600";
  const varianceTone = evm.varianceAtCompletionTco2e >= 0 ? "text-green-700" : "text-red-600";

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
        <Gauge className="h-4 w-4 text-[#f97316]" />
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Carbon earned value</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {evm.method === "cpi_trend"
              ? "Forecast follows the current carbon performance trend."
              : "Forecast assumes remaining work goes exactly to budget (not enough progress yet for a performance trend)."}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-50">
        <div className="p-5">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">Earned value</div>
          <div className="text-xl font-semibold text-gray-900 tabular-nums">{evm.earnedValueTco2e.toFixed(1)}</div>
          <div className="text-xs text-gray-400 mt-0.5">tCO2e of budgeted work done</div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">Carbon performance index</div>
          <div className={`text-xl font-semibold tabular-nums ${cpiTone}`}>{cpiLabel}</div>
          <div className="text-xs text-gray-400 mt-0.5">Above 1.00 is ahead of budget</div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">Forecast at completion</div>
          <div className="text-xl font-semibold text-gray-900 tabular-nums">{evm.forecastAtCompletionTco2e.toFixed(1)}</div>
          <div className="text-xs text-gray-400 mt-0.5">tCO2e, vs {evm.budgetAtCompletionTco2e.toFixed(1)} budgeted</div>
        </div>
        <div className="p-5">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">Variance at completion</div>
          <div className={`text-xl font-semibold tabular-nums ${varianceTone}`}>
            {evm.varianceAtCompletionTco2e >= 0 ? "+" : ""}{evm.varianceAtCompletionTco2e.toFixed(1)}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">tCO2e {evm.varianceAtCompletionTco2e >= 0 ? "under" : "over"} budget</div>
        </div>
      </div>
    </div>
  );
}

export default function CarbonBudgetPage() {
  const params = useParams<{ orgId: string; contractId: string; projectId: string }>();
  const { orgId, contractId, projectId } = params;

  const [budget, setBudget] = useState<Budget | null>(null);
  const [totalActualTco2e, setTotalActualTco2e] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/contracts/${contractId}/projects/${projectId}/carbon-budget`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setLoadError(d.message ?? "Could not load the carbon budget.");
        return;
      }
      const d = await res.json();
      setBudget(d.budget);
      setTotalActualTco2e(d.totalActualTco2e);
    } catch {
      setLoadError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [orgId, contractId, projectId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const budgetTco2e = budget ? Number(budget.totalBudgetTco2e) : 0;
  const usedPct = budgetTco2e > 0 ? Math.round((totalActualTco2e / budgetTco2e) * 100) : 0;
  const remaining = budgetTco2e - totalActualTco2e;
  const alert = budget ? alertLevel(totalActualTco2e, budgetTco2e) : null;

  const intensityPerM2 = budget?.floorAreaM2 && budgetTco2e > 0
    ? (budgetTco2e / Number(budget.floorAreaM2)).toFixed(2)
    : null;
  const intensityPerMGbp = budget?.contractValueGbp && budgetTco2e > 0
    ? ((budgetTco2e / Number(budget.contractValueGbp)) * 1_000_000).toFixed(1)
    : null;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Carbon Budget</h1>
          <p className="text-sm text-gray-500 mt-1">Track emissions against project carbon budget in real time.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#ea580c] transition-colors"
        >
          {budget ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {budget ? "Edit budget" : "Set budget"}
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-gray-400">Loading...</div>
      ) : loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-12 text-center">
          <p className="text-sm font-medium text-red-600">{loadError}</p>
          <button
            onClick={load}
            className="mt-4 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Try again
          </button>
        </div>
      ) : !budget ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-[#F0F9FF] flex items-center justify-center">
            <Target className="h-5 w-5 text-[#f97316]" />
          </div>
          <p className="text-sm font-medium text-gray-700">No carbon budget set</p>
          <p className="text-xs text-gray-400 mt-1">Set a tCO2e limit to track project emissions against your budget.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Alert banner */}
          {alert && (
            <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${alert.cls}`}>
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm font-medium">{alert.label} - {usedPct}% of carbon budget used</span>
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Budget", value: `${budgetTco2e.toFixed(1)}`, unit: "tCO2e", color: "text-gray-900" },
              { label: "Actual", value: `${totalActualTco2e.toFixed(1)}`, unit: "tCO2e", color: usedPct >= 100 ? "text-red-600" : "text-gray-900" },
              { label: "Remaining", value: `${Math.abs(remaining).toFixed(1)}`, unit: remaining < 0 ? "tCO2e over" : "tCO2e left", color: remaining < 0 ? "text-red-600" : "text-green-700" },
              { label: "Used", value: `${usedPct}%`, unit: "of budget", color: usedPct >= 100 ? "text-red-600" : "text-gray-900" },
            ].map(({ label, value, unit, color }) => (
              <div key={label} className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">{label}</div>
                <div className={`text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
                <div className="text-xs text-gray-400 mt-0.5">{unit}</div>
              </div>
            ))}
          </div>

          {/* Overall progress */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-900">Overall progress</span>
              <span className="text-sm font-medium tabular-nums text-gray-600">{usedPct}%</span>
            </div>
            <ProgressBar actual={totalActualTco2e} budget={budgetTco2e} />
            <div className="flex justify-between mt-2 text-xs text-gray-400">
              <span>0</span>
              <span className="text-amber-500">80% ({(budgetTco2e * 0.8).toFixed(0)} tCO2e)</span>
              <span>{budgetTco2e.toFixed(0)} tCO2e</span>
            </div>
          </div>

          {/* KPI intensities */}
          {(intensityPerM2 || intensityPerMGbp) && (
            <div className="grid grid-cols-2 gap-4">
              {intensityPerM2 && (
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-[#f97316]" />
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-widest">Budget intensity</span>
                  </div>
                  <div className="text-xl font-semibold text-gray-900 tabular-nums">{intensityPerM2}</div>
                  <div className="text-xs text-gray-400">tCO2e / m2</div>
                </div>
              )}
              {intensityPerMGbp && (
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-[#f97316]" />
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-widest">Spend intensity</span>
                  </div>
                  <div className="text-xl font-semibold text-gray-900 tabular-nums">{intensityPerMGbp}</div>
                  <div className="text-xs text-gray-400">tCO2e / £1M spend</div>
                </div>
              )}
            </div>
          )}

          {/* Phases */}
          {budget.phases.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Budget by phase</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Actual tCO2e and percent complete are reconciled manually per phase.
                </p>
              </div>
              <div className="divide-y divide-gray-50">
                {budget.phases.map((phase) => (
                  <PhaseRow
                    key={phase.id}
                    orgId={orgId}
                    contractId={contractId}
                    projectId={projectId}
                    phase={phase}
                    onUpdated={() => { setLoading(true); load(); }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Carbon EVM */}
          {budget.phases.length > 0 && <CarbonEvmCard phases={budget.phases} />}

          {/* Notes */}
          {budget.notes && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4">
              <p className="text-xs font-medium text-gray-500 mb-1">Notes</p>
              <p className="text-sm text-gray-700">{budget.notes}</p>
            </div>
          )}

          {/* On-track indicator */}
          <div className={`rounded-xl border px-5 py-4 flex items-center gap-3 ${
            usedPct >= 100 ? "border-red-200 bg-red-50" : usedPct >= 80 ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50"
          }`}>
            {usedPct >= 100 ? (
              <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
            )}
            <div>
              <p className={`text-sm font-medium ${usedPct >= 100 ? "text-red-700" : usedPct >= 80 ? "text-amber-700" : "text-green-700"}`}>
                {usedPct >= 120 ? "Over budget - immediate action required"
                  : usedPct >= 100 ? "Budget reached - monitor closely"
                  : usedPct >= 80 ? "Approaching budget limit"
                  : "On track"}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {remaining >= 0
                  ? `${remaining.toFixed(1)} tCO2e remaining (${100 - usedPct}% headroom)`
                  : `${Math.abs(remaining).toFixed(1)} tCO2e over budget`}
              </p>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <SetBudgetModal
          orgId={orgId} contractId={contractId} projectId={projectId}
          existing={budget}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); setLoading(true); load(); }}
        />
      )}
    </div>
  );
}
