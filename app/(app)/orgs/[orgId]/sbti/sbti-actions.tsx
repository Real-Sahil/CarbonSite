"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Target, X } from "lucide-react";

export interface SbtiTarget {
  pathway: string;
  baseYear: number;
  baselineScope1Tco2e: number;
  baselineScope2Tco2e: number;
  baselineScope3Tco2e: number | null;
  nearTermYear: number;
  nearTermReductionPct: number;
  netZeroYear: number;
  netZeroReductionPct: number;
  status: string;
  notes: string | null;
}

export const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  draft:     { label: "Draft",     cls: "bg-gray-100 text-gray-600" },
  committed: { label: "Committed", cls: "bg-blue-100 text-blue-700" },
  validated: { label: "Validated", cls: "bg-green-100 text-green-700" },
};

interface PathwaySuggestion {
  totalReductionPercent: number;
  annualReductionRate: number;
  pathwayDescription: string;
  recommendations: string[];
}

function SetTargetModal({ orgId, existing, onClose, onSaved }: {
  orgId: string;
  existing: SbtiTarget | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    pathway: existing?.pathway ?? "1.5C",
    baseYear: (existing?.baseYear ?? new Date().getFullYear() - 1).toString(),
    baselineScope1Tco2e: existing != null ? existing.baselineScope1Tco2e.toString() : "",
    baselineScope2Tco2e: existing != null ? existing.baselineScope2Tco2e.toString() : "",
    baselineScope3Tco2e: existing?.baselineScope3Tco2e != null ? existing.baselineScope3Tco2e.toString() : "",
    nearTermYear: (existing?.nearTermYear ?? 2030).toString(),
    nearTermReductionPct: existing != null ? existing.nearTermReductionPct.toString() : "50",
    netZeroYear: (existing?.netZeroYear ?? 2050).toString(),
    netZeroReductionPct: existing != null ? existing.netZeroReductionPct.toString() : "90",
    status: existing?.status ?? "draft",
    notes: existing?.notes ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [calcPathway, setCalcPathway] = useState<"1.5C" | "2C" | "2.5C">("1.5C");
  const [suggestion, setSuggestion] = useState<PathwaySuggestion | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState("");

  async function calculateSuggestion() {
    const baselineEmissions =
      Number(form.baselineScope1Tco2e || 0) +
      Number(form.baselineScope2Tco2e || 0) +
      Number(form.baselineScope3Tco2e || 0);
    if (!form.baseYear || !form.nearTermYear || baselineEmissions <= 0) {
      setCalcError("Enter a base year, near-term year and at least Scope 1+2 baseline first.");
      return;
    }
    setCalcError("");
    setCalculating(true);
    setSuggestion(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/targets/sbti-pathway`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baselineYear: Number(form.baseYear),
          baselineEmissions,
          targetYear: Number(form.nearTermYear),
          pathway: calcPathway,
          scope1: Number(form.baselineScope1Tco2e || 0),
          scope2: Number(form.baselineScope2Tco2e || 0),
          scope3: Number(form.baselineScope3Tco2e || 0),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCalcError((body as { message?: string }).message ?? "Could not calculate a suggested pathway.");
        return;
      }
      setSuggestion((body as { pathway: PathwaySuggestion }).pathway);
    } catch {
      setCalcError("Network error. Try again.");
    } finally {
      setCalculating(false);
    }
  }

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
        setError((d as { message?: string }).message ?? "Could not save.");
        return;
      }
      onSaved();
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#c2410c] focus:ring-2 focus:ring-[#c2410c]/15 disabled:opacity-50";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{existing ? "Edit" : "Set"} SBTi net-zero target</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
            <X className="h-4 w-4 text-gray-500" />
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

          <div className="rounded-lg bg-[#FFF7ED] border border-[#FED7AA] px-4 py-3">
            <p className="text-xs font-medium text-[#c2410c] mb-2">Baseline emissions (tCO2e)</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: "baselineScope1Tco2e", label: "Scope 1", required: true },
                { key: "baselineScope2Tco2e", label: "Scope 2", required: true },
                { key: "baselineScope3Tco2e", label: "Scope 3 (opt.)", required: false },
              ].map(({ key, label, required }) => (
                <div key={key}>
                  <label className="block text-xs text-[#c2410c] mb-1">{label}</label>
                  <input type="number" min={0} step="0.01"
                    value={form[key as keyof typeof form] as string}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    required={required}
                    className="w-full rounded-lg border border-[#E5E7EB] bg-white px-2 py-1.5 text-sm text-[#111827] outline-none focus:border-[#c2410c] focus:ring-1 focus:ring-[#c2410c]/20"
                    placeholder="0" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-xs font-medium text-gray-700 mb-2">
              Not sure what reduction % to commit to? Calculate what a pathway requires.
            </p>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Pathway to model</label>
                <select value={calcPathway} onChange={(e) => setCalcPathway(e.target.value as typeof calcPathway)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-[#c2410c] focus:ring-1 focus:ring-[#c2410c]/20">
                  <option value="1.5C">1.5°C (4.2%/year)</option>
                  <option value="2C">2°C (3.0%/year)</option>
                  <option value="2.5C">2.5°C (2.0%/year)</option>
                </select>
              </div>
              <button type="button" onClick={calculateSuggestion} disabled={calculating}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50">
                {calculating ? "Calculating..." : "Calculate"}
              </button>
            </div>
            {calcError && <p className="text-xs text-red-600 mt-2">{calcError}</p>}
            {suggestion && (
              <div className="mt-3 rounded-lg bg-white border border-gray-200 px-3 py-2.5">
                <p className="text-sm text-gray-900">
                  Reaching {form.nearTermYear} on this pathway needs{" "}
                  <span className="font-semibold">{suggestion.totalReductionPercent.toFixed(1)}%</span> total reduction
                  (~{suggestion.annualReductionRate.toFixed(1)}%/year).
                </p>
                {suggestion.recommendations.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5 text-xs text-gray-500 list-disc list-inside">
                    {suggestion.recommendations.slice(0, 2).map((rec, i) => <li key={i}>{rec}</li>)}
                  </ul>
                )}
                <button type="button"
                  onClick={() => setForm((f) => ({ ...f, nearTermReductionPct: suggestion!.totalReductionPercent.toFixed(1) }))}
                  className="mt-2 text-xs font-medium text-[#c2410c] hover:text-[#9a3412]">
                  Use this % for near-term reduction
                </button>
              </div>
            )}
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
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes <span className="text-gray-500">(optional)</span></label>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className={`${inputCls} resize-none`} placeholder="SBTi submission date, validation notes..." />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-[#c2410c] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#9a3412] disabled:opacity-60 transition-colors">
            {loading ? "Saving..." : existing ? "Update target" : "Set SBTi target"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function SbtiSetTargetButton({ orgId, existing }: { orgId: string; existing: SbtiTarget | null }) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button onClick={() => setShowModal(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-[#c2410c] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#9a3412] transition-colors">
        <Target className="h-4 w-4" />
        {existing ? "Edit target" : "Set SBTi target"}
      </button>
      {showModal && (
        <SetTargetModal
          orgId={orgId}
          existing={existing}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); router.refresh(); }}
        />
      )}
    </>
  );
}
