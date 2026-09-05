"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Layers, Settings2, X, AlertCircle } from "lucide-react";

interface WholeLifeResult {
  aStagesKgCo2e: number;
  b4ReplacementKgCo2e: number;
  b6OperationalEnergyKgCo2e: number;
  b7OperationalWaterKgCo2e: number;
  cStagesKgCo2e: number;
  moduleDMemoKgCo2e: number;
  wholeLifeTotalKgCo2e: number;
  warnings: string[];
}

interface Assessment {
  id: string;
  assessmentPeriodYears: number;
  operationalStartDate: string | null;
  operationalWaterKgCo2eManual: string | null;
  notes: string | null;
}

const MODULES = [
  { key: "aStagesKgCo2e", label: "A1-A5", sub: "Product & construction", color: "bg-[#f97316]" },
  { key: "b4ReplacementKgCo2e", label: "B4", sub: "Replacement", color: "bg-amber-400" },
  { key: "b6OperationalEnergyKgCo2e", label: "B6", sub: "Operational energy (measured)", color: "bg-blue-400" },
  { key: "b7OperationalWaterKgCo2e", label: "B7", sub: "Operational water", color: "bg-cyan-400" },
  { key: "cStagesKgCo2e", label: "C1-C4", sub: "End of life", color: "bg-zinc-400" },
] as const;

function fmt(kg: number): string {
  return `${(kg / 1000).toLocaleString("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} tCO2e`;
}

function SettingsModal({
  orgId, contractId, projectId, existing, onClose, onSaved,
}: {
  orgId: string; contractId: string; projectId: string;
  existing: Assessment | null; onClose: () => void; onSaved: () => void;
}) {
  const [years, setYears] = useState(existing?.assessmentPeriodYears?.toString() ?? "60");
  const [operationalStartDate, setOperationalStartDate] = useState(existing?.operationalStartDate?.slice(0, 10) ?? "");
  const [water, setWater] = useState(existing?.operationalWaterKgCo2eManual ? String(Number(existing.operationalWaterKgCo2eManual)) : "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(
        `/api/orgs/${orgId}/contracts/${contractId}/projects/${projectId}/whole-life-carbon`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assessmentPeriodYears: Number(years),
            operationalStartDate: operationalStartDate || undefined,
            operationalWaterKgCo2eManual: water ? Number(water) : undefined,
            notes: notes || undefined,
          }),
        },
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.message ?? "Could not save assessment settings.");
        return;
      }
      onSaved();
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#f97316] focus:ring-2 focus:ring-[#f97316]/15";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Assessment settings</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Study period (years)</label>
            <input type="number" required min="1" max="120" value={years} onChange={(e) => setYears(e.target.value)} className={inputCls} />
            <p className="text-xs text-gray-500 mt-1">RICS default for buildings is 60 years.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Operational start date <span className="text-gray-500">(optional)</span></label>
            <input type="date" value={operationalStartDate} onChange={(e) => setOperationalStartDate(e.target.value)} className={inputCls} />
            <p className="text-xs text-gray-500 mt-1">Only activity on or after this date counts toward B6.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">B7 operational water (kgCO2e) <span className="text-gray-500">(optional, manual)</span></label>
            <input type="number" min="0" step="0.01" value={water} onChange={(e) => setWater(e.target.value)} className={inputCls} placeholder="No automated water tracking yet" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes <span className="text-gray-500">(optional)</span></label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputCls} resize-none`} />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={loading} className="w-full rounded-lg bg-[#f97316] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#ea580c] disabled:opacity-60 transition-colors">
            {loading ? "Saving..." : "Save settings"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function WholeLifeCarbonPage() {
  const params = useParams<{ orgId: string; contractId: string; projectId: string }>();
  const { orgId, contractId, projectId } = params;

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [result, setResult] = useState<WholeLifeResult | null>(null);
  const [materialRecordCount, setMaterialRecordCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/contracts/${contractId}/projects/${projectId}/whole-life-carbon`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setLoadError(d.message ?? "Could not load whole-life carbon data.");
        return;
      }
      const d = await res.json();
      setAssessment(d.assessment);
      setResult(d.result);
      setMaterialRecordCount(d.materialRecordCount);
    } catch {
      setLoadError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [orgId, contractId, projectId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const maxModuleKg = result
    ? Math.max(...MODULES.map((m) => Math.abs(result[m.key])), 1)
    : 1;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Whole-life carbon</h1>
          <p className="text-sm text-gray-500 mt-1">
            EN 15978 modules A to D, per the RICS whole life carbon assessment methodology.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Settings2 className="h-4 w-4" />
          Assessment settings
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-gray-500">Loading...</div>
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
      ) : !result ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-[#F0F9FF] flex items-center justify-center">
            <Layers className="h-5 w-5 text-[#f97316]" />
          </div>
          <p className="text-sm font-medium text-gray-700">No whole-life carbon data yet</p>
          <p className="text-xs text-gray-500 mt-1">Add embodied carbon records for this project to see a breakdown.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-gray-900">Whole-life total</span>
              <span className="text-2xl font-semibold text-gray-900 tabular-nums">{fmt(result.wholeLifeTotalKgCo2e)}</span>
            </div>
            <p className="text-xs text-gray-500">
              A + B4 + B6 + B7 + C, over a {assessment?.assessmentPeriodYears ?? 60}-year study period.
              Module D is reported separately below, not included in this total.
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Breakdown by module</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {MODULES.map((m) => {
                const value = result[m.key];
                const widthPct = maxModuleKg > 0 ? (Math.abs(value) / maxModuleKg) * 100 : 0;
                return (
                  <div key={m.key} className="px-6 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-semibold text-gray-900">{m.label}</span>
                        <span className="text-xs text-gray-500">{m.sub}</span>
                      </div>
                      <span className="text-sm text-gray-600 tabular-nums">{fmt(value)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className={`h-full rounded-full ${m.color}`} style={{ width: `${widthPct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-1">Module D (memo)</p>
              <p className="text-xs text-gray-500">Benefits and loads beyond the system boundary. Reported separately per EN 15978, never netted into the total.</p>
            </div>
            <span className="text-lg font-semibold text-gray-900 tabular-nums">{fmt(result.moduleDMemoKgCo2e)}</span>
          </div>

          {result.warnings.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">Assumptions and gaps</span>
              </div>
              <ul className="space-y-1.5">
                {result.warnings.map((w, i) => (
                  <li key={i} className="text-xs text-amber-700 leading-relaxed">{w}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-gray-500 text-center">
            Based on {materialRecordCount} embodied carbon record{materialRecordCount === 1 ? "" : "s"} for this project.
          </p>
        </div>
      )}

      {showModal && (
        <SettingsModal
          orgId={orgId} contractId={contractId} projectId={projectId}
          existing={assessment}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); setLoading(true); load(); }}
        />
      )}
    </div>
  );
}
