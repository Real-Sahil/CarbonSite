"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Leaf, Plus, Trash2, ExternalLink, X } from "lucide-react";

interface CarbonOffset {
  id: string;
  provider: string;
  projectName: string;
  projectType: string;
  standard: string;
  vintage: number;
  quantityTonnes: string;
  pricePerTonne: string | null;
  currency: string;
  purchasedAt: string;
  retirementRef: string | null;
  notes: string | null;
}

const PROJECT_TYPES = [
  { value: "forestry",           label: "Forestry / REDD+" },
  { value: "renewable_energy",   label: "Renewable energy" },
  { value: "methane_capture",    label: "Methane capture" },
  { value: "blue_carbon",        label: "Blue carbon" },
  { value: "soil_carbon",        label: "Soil carbon" },
  { value: "direct_air_capture", label: "Direct air capture" },
  { value: "other",              label: "Other" },
];

const STANDARDS = ["VCS", "Gold_Standard", "REDD+", "Plan_Vivo", "ACR", "CAR", "Other"];

const STATUS_COLORS: Record<string, string> = {
  forestry:           "bg-green-100 text-green-700",
  renewable_energy:   "bg-[#EEF2FF] text-[#4F46E5]",
  methane_capture:    "bg-purple-100 text-purple-700",
  blue_carbon:        "bg-blue-100 text-blue-700",
  soil_carbon:        "bg-amber-100 text-amber-700",
  direct_air_capture: "bg-rose-100 text-rose-700",
  other:              "bg-gray-100 text-gray-600",
};

function AddOffsetModal({ orgId, onClose, onSaved }: { orgId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    provider: "", projectName: "", projectType: "forestry",
    standard: "VCS", vintage: new Date().getFullYear() - 1,
    quantityTonnes: "", pricePerTonne: "", currency: "GBP",
    purchasedAt: new Date().toISOString().slice(0, 10),
    retirementRef: "", notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function set(k: string, v: string | number) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/offsets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          vintage: Number(form.vintage),
          quantityTonnes: Number(form.quantityTonnes),
          pricePerTonne: form.pricePerTonne ? Number(form.pricePerTonne) : undefined,
          purchasedAt: new Date(form.purchasedAt).toISOString(),
          retirementRef: form.retirementRef || undefined,
          notes: form.notes || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.message ?? "Failed to save offset.");
        return;
      }
      onSaved();
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/15 disabled:opacity-50";
  const labelCls = "block text-xs font-medium text-gray-600 mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Add carbon offset</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Project name</label>
              <input type="text" required value={form.projectName} onChange={(e) => set("projectName", e.target.value)} className={inputCls} placeholder="Acre Amazon REDD+ Project" />
            </div>
            <div>
              <label className={labelCls}>Provider / registry</label>
              <input type="text" required value={form.provider} onChange={(e) => set("provider", e.target.value)} className={inputCls} placeholder="South Pole, ClimateCare..." />
            </div>
            <div>
              <label className={labelCls}>Standard</label>
              <select value={form.standard} onChange={(e) => set("standard", e.target.value)} className={inputCls}>
                {STANDARDS.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Project type</label>
              <select value={form.projectType} onChange={(e) => set("projectType", e.target.value)} className={inputCls}>
                {PROJECT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Vintage year</label>
              <input type="number" required min={2000} max={2050} value={form.vintage} onChange={(e) => set("vintage", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Quantity (tCO2e)</label>
              <input type="number" required min="0.0001" step="0.0001" value={form.quantityTonnes} onChange={(e) => set("quantityTonnes", e.target.value)} className={inputCls} placeholder="100.0000" />
            </div>
            <div>
              <label className={labelCls}>Price / tonne <span className="text-gray-400">(optional)</span></label>
              <input type="number" min="0" step="0.01" value={form.pricePerTonne} onChange={(e) => set("pricePerTonne", e.target.value)} className={inputCls} placeholder="15.00" />
            </div>
            <div>
              <label className={labelCls}>Currency</label>
              <input type="text" maxLength={3} value={form.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Purchase date</label>
              <input type="date" required value={form.purchasedAt} onChange={(e) => set("purchasedAt", e.target.value)} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Retirement ref <span className="text-gray-400">(optional)</span></label>
              <input type="text" value={form.retirementRef} onChange={(e) => set("retirementRef", e.target.value)} className={inputCls} placeholder="Gold Standard retirement certificate #..." />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Notes <span className="text-gray-400">(optional)</span></label>
              <textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} className={`${inputCls} resize-none`} />
            </div>
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={loading} className="w-full rounded-lg bg-[#4F46E5] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#4338CA] disabled:opacity-60 transition-colors">
            {loading ? "Saving..." : "Save offset"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function OffsetsPage() {
  const params = useParams<{ orgId: string }>();
  const orgId = params.orgId;
  const [offsets, setOffsets] = useState<CarbonOffset[]>([]);
  const [totalTonnes, setTotalTonnes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  async function load() {
    const res = await fetch(`/api/orgs/${orgId}/offsets`);
    if (res.ok) {
      const d = await res.json();
      setOffsets(d.data);
      setTotalTonnes(d.totalTonnes);
    }
    setLoading(false);
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [orgId]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this offset record?")) return;
    await fetch(`/api/orgs/${orgId}/offsets/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Carbon Offsets</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track verified carbon credits purchased to offset residual emissions.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#4F46E5] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#4338CA] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add offset
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">Total purchased</div>
          <div className="text-2xl font-semibold text-gray-900 tabular-nums">{totalTonnes.toFixed(1)}</div>
          <div className="text-xs text-gray-400 mt-0.5">tCO2e</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">Projects tracked</div>
          <div className="text-2xl font-semibold text-gray-900 tabular-nums">{offsets.length}</div>
          <div className="text-xs text-gray-400 mt-0.5">offset records</div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-400">Loading...</div>
        ) : offsets.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-green-50 flex items-center justify-center">
              <Leaf className="h-5 w-5 text-green-500" />
            </div>
            <p className="text-sm font-medium text-gray-700">No offsets yet</p>
            <p className="text-xs text-gray-400 mt-1">Add your first carbon credit purchase to track net position.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr>
                {["Project", "Type", "Standard", "Vintage", "Quantity (tCO2e)", "Purchased", ""].map((h) => (
                  <th key={h} className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide first:pl-6 last:pr-6">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {offsets.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 pl-6 pr-4">
                    <p className="font-medium text-gray-900 truncate max-w-[200px]">{o.projectName}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">{o.provider}</p>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[o.projectType] ?? "bg-gray-100 text-gray-600"}`}>
                      {PROJECT_TYPES.find((t) => t.value === o.projectType)?.label ?? o.projectType}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-600">{o.standard.replace("_", " ")}</td>
                  <td className="py-3 px-4 text-gray-600 tabular-nums">{o.vintage}</td>
                  <td className="py-3 px-4 text-gray-900 font-medium tabular-nums">{Number(o.quantityTonnes).toFixed(2)}</td>
                  <td className="py-3 px-4 text-gray-500 tabular-nums">{new Date(o.purchasedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                  <td className="py-3 pl-4 pr-6">
                    <div className="flex items-center gap-2 justify-end">
                      {o.retirementRef && (
                        <span title={o.retirementRef}>
                          <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
                        </span>
                      )}
                      <button onClick={() => handleDelete(o.id)} className="h-7 w-7 rounded-lg hover:bg-red-50 flex items-center justify-center group">
                        <Trash2 className="h-3.5 w-3.5 text-gray-300 group-hover:text-red-500 transition-colors" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && (
        <AddOffsetModal
          orgId={orgId}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load(); }}
        />
      )}
    </div>
  );
}
