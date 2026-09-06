"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Trash2, Plus, X, BarChart3, Upload } from "lucide-react";

interface WasteRecord {
  id: string;
  wasteType: string;
  disposalRoute: string;
  hazardous: boolean;
  weightTonnes: string;
  co2eTonnes: string | null;
  ewcCode: string | null;
  carrierName: string | null;
  recordedAt: string;
  notes: string | null;
  facility: { id: string; name: string } | null;
}

interface Facility { id: string; name: string }
interface Period { id: string; label: string }

const DISPOSAL_ROUTES = [
  { value: "landfill_mixed",        label: "Landfill - Mixed waste",      hierarchy: "landfill" },
  { value: "landfill_food",         label: "Landfill - Food waste",        hierarchy: "landfill" },
  { value: "landfill_wood",         label: "Landfill - Wood",              hierarchy: "landfill" },
  { value: "landfill_plastic",      label: "Landfill - Plastic",           hierarchy: "landfill" },
  { value: "incineration_efw",      label: "Energy from Waste (EfW)",      hierarchy: "recovery" },
  { value: "recycling_paper",       label: "Recycling - Paper",            hierarchy: "recycle" },
  { value: "recycling_cardboard",   label: "Recycling - Cardboard",        hierarchy: "recycle" },
  { value: "recycling_plastic",     label: "Recycling - Plastic",          hierarchy: "recycle" },
  { value: "recycling_glass",       label: "Recycling - Glass",            hierarchy: "recycle" },
  { value: "recycling_metal",       label: "Recycling - Metal",            hierarchy: "recycle" },
  { value: "recycling_mixed",       label: "Recycling - Mixed",            hierarchy: "recycle" },
  { value: "composting_food",       label: "Composting - Food waste",      hierarchy: "recycle" },
  { value: "composting_garden",     label: "Composting - Garden waste",    hierarchy: "recycle" },
  { value: "anaerobic_digestion",   label: "Anaerobic Digestion",          hierarchy: "recycle" },
  { value: "hazardous_landfill",    label: "Hazardous waste - Landfill",   hierarchy: "landfill" },
];

const HIERARCHY_COLORS: Record<string, string> = {
  recycle:  "bg-green-100 text-green-700",
  recovery: "bg-amber-100 text-amber-700",
  landfill: "bg-red-100 text-red-700",
};

function AddRecordModal({
  orgId, facilities, periods, onClose, onSaved,
}: { orgId: string; facilities: Facility[]; periods: Period[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    facilityId: facilities[0]?.id ?? "",
    reportingPeriodId: periods[0]?.id ?? "",
    wasteType: "", disposalRoute: "recycling_mixed", hazardous: false,
    weightTonnes: "", ewcCode: "", carrierName: "",
    recordedAt: new Date().toISOString().slice(0, 10), notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/waste-records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facilityId: form.facilityId,
          reportingPeriodId: form.reportingPeriodId,
          wasteType: form.wasteType,
          disposalRoute: form.disposalRoute,
          hazardous: form.hazardous,
          weightTonnes: Number(form.weightTonnes),
          ewcCode: form.ewcCode || undefined,
          carrierName: form.carrierName || undefined,
          recordedAt: new Date(form.recordedAt).toISOString(),
          notes: form.notes || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.message ?? "Failed to save.");
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
          <h2 className="text-base font-semibold text-gray-900">Add waste record</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Facility</label>
              <select required value={form.facilityId}
                onChange={(e) => setForm((f) => ({ ...f, facilityId: e.target.value }))} className={inputCls}>
                <option value="" disabled>Select a facility</option>
                {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Reporting period</label>
              <select required value={form.reportingPeriodId}
                onChange={(e) => setForm((f) => ({ ...f, reportingPeriodId: e.target.value }))} className={inputCls}>
                <option value="" disabled>Select a period</option>
                {periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Waste type / description</label>
            <input type="text" required value={form.wasteType}
              onChange={(e) => setForm((f) => ({ ...f, wasteType: e.target.value }))}
              className={inputCls} placeholder="Mixed construction waste, concrete, timber..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Disposal route</label>
            <select value={form.disposalRoute}
              onChange={(e) => setForm((f) => ({ ...f, disposalRoute: e.target.value }))} className={inputCls}>
              {DISPOSAL_ROUTES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.hazardous}
              onChange={(e) => setForm((f) => ({ ...f, hazardous: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-[#f97316] focus:ring-[#f97316]/30" />
            Hazardous waste (ESRS E5 disclosure)
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Weight (tonnes)</label>
              <input type="number" required min="0.001" step="0.001" value={form.weightTonnes}
                onChange={(e) => setForm((f) => ({ ...f, weightTonnes: e.target.value }))}
                className={inputCls} placeholder="12.500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
              <input type="date" required value={form.recordedAt}
                onChange={(e) => setForm((f) => ({ ...f, recordedAt: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            CO2e is calculated automatically from your organisation&apos;s emission factor library once saved.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">EWC code <span className="text-gray-500">(optional)</span></label>
              <input type="text" value={form.ewcCode} maxLength={10}
                onChange={(e) => setForm((f) => ({ ...f, ewcCode: e.target.value }))}
                className={inputCls} placeholder="17 09 04" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Carrier name <span className="text-gray-500">(optional)</span></label>
              <input type="text" value={form.carrierName}
                onChange={(e) => setForm((f) => ({ ...f, carrierName: e.target.value }))}
                className={inputCls} placeholder="Biffa, Veolia..." />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes <span className="text-gray-500">(optional)</span></label>
            <textarea rows={2} value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className={`${inputCls} resize-none`} />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={loading || !form.facilityId || !form.reportingPeriodId}
            className="w-full rounded-lg bg-[#f97316] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#ea580c] disabled:opacity-60 transition-colors">
            {loading ? "Saving..." : "Save waste record"}
          </button>
        </form>
      </div>
    </div>
  );
}

function BulkUploadModal({ orgId, onClose, onDone }: { orgId: string; onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; failed: number; errors: { row: number; message: string }[] } | null>(null);

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/orgs/${orgId}/waste-records/bulk`, { method: "POST", body: formData });
      const data = await res.json();
      setResult(data);
      if (res.ok && data.created > 0) onDone();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Bulk upload waste records</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <p className="text-xs text-gray-500">
            CSV columns: facilityId, reportingPeriodId, wasteType, disposalRoute, hazardous, weightTonnes, ewcCode, carrierName, recordedAt, notes
          </p>
          <input type="file" accept=".csv,.xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-xs file:font-medium" />
          {result && (
            <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-700">
              <p>{result.created} created, {result.failed} failed.</p>
              {result.errors.slice(0, 8).map((e, i) => (
                <p key={i} className="text-red-600 mt-1">Row {e.row}: {e.message}</p>
              ))}
            </div>
          )}
          <button onClick={handleUpload} disabled={!file || loading}
            className="w-full rounded-lg bg-[#f97316] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#ea580c] disabled:opacity-60 transition-colors">
            {loading ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WastePage() {
  const params = useParams<{ orgId: string }>();
  const orgId = params.orgId;
  const [records, setRecords] = useState<WasteRecord[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [totalWeight, setTotalWeight] = useState(0);
  const [totalCo2e, setTotalCo2e] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);

  async function load() {
    const [recordsRes, facilitiesRes, periodsRes] = await Promise.all([
      fetch(`/api/orgs/${orgId}/waste-records`),
      fetch(`/api/orgs/${orgId}/facilities`),
      fetch(`/api/orgs/${orgId}/reporting-periods`),
    ]);
    if (recordsRes.ok) {
      const d = await recordsRes.json();
      setRecords(d.data);
      setTotalWeight(d.totalWeightTonnes);
      setTotalCo2e(d.totalCo2eTonnes);
    }
    if (facilitiesRes.ok) setFacilities(await facilitiesRes.json());
    if (periodsRes.ok) setPeriods((await periodsRes.json()).periods);
    setLoading(false);
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [orgId]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this waste record?")) return;
    await fetch(`/api/orgs/${orgId}/waste-records/${id}`, { method: "DELETE" });
    load();
  }

  const byHierarchy = records.reduce<Record<string, { weight: number; co2e: number }>>((acc, r) => {
    const route = DISPOSAL_ROUTES.find((d) => d.value === r.disposalRoute);
    const h = route?.hierarchy ?? "landfill";
    if (!acc[h]) acc[h] = { weight: 0, co2e: 0 };
    acc[h].weight += Number(r.weightTonnes);
    acc[h].co2e += Number(r.co2eTonnes ?? 0);
    return acc;
  }, {});

  const recycledPct = totalWeight > 0
    ? Math.round(((byHierarchy.recycle?.weight ?? 0) / totalWeight) * 100)
    : 0;
  const hazardousTonnes = records.filter((r) => r.hazardous).reduce((sum, r) => sum + Number(r.weightTonnes), 0);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Waste Emissions</h1>
          <p className="text-sm text-gray-500 mt-1">Track waste disposal routes for ESRS E5 and Scope 3 Category 5 emissions.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowBulk(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <Upload className="h-4 w-4" />
            Bulk upload
          </button>
          <button onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#ea580c] transition-colors">
            <Plus className="h-4 w-4" />
            Add waste record
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { label: "Total waste", value: totalWeight.toFixed(2), unit: "tonnes" },
          { label: "Total emissions", value: totalCo2e.toFixed(3), unit: "tCO2e" },
          { label: "Recycled / diverted", value: `${recycledPct}%`, unit: "of waste weight" },
          { label: "Hazardous", value: hazardousTonnes.toFixed(2), unit: "tonnes" },
          { label: "Records", value: records.length.toString(), unit: "waste records" },
        ].map(({ label, value, unit }) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-1">{label}</div>
            <div className="text-2xl font-semibold text-gray-900 tabular-nums">{value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{unit}</div>
          </div>
        ))}
      </div>

      {records.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900">Waste hierarchy</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: "recycle", label: "Recycled / Composted", cls: "bg-green-50 border-green-200" },
              { key: "recovery", label: "Energy Recovery (EfW)", cls: "bg-amber-50 border-amber-200" },
              { key: "landfill", label: "Landfill / Disposal", cls: "bg-red-50 border-red-200" },
            ].map(({ key, label, cls }) => {
              const data = byHierarchy[key];
              const pct = totalWeight > 0 ? Math.round(((data?.weight ?? 0) / totalWeight) * 100) : 0;
              return (
                <div key={key} className={`rounded-lg border p-4 ${cls}`}>
                  <p className="text-xs font-medium text-gray-600 mb-1">{label}</p>
                  <p className="text-xl font-semibold text-gray-900 tabular-nums">{pct}%</p>
                  <p className="text-xs text-gray-500">{(data?.weight ?? 0).toFixed(2)} t</p>
                  <p className="text-xs text-gray-500">{(data?.co2e ?? 0).toFixed(4)} tCO2e</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">Loading...</div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-gray-50 flex items-center justify-center">
              <Trash2 className="h-5 w-5 text-gray-500" />
            </div>
            <p className="text-sm font-medium text-gray-700">No waste records</p>
            <p className="text-xs text-gray-500 mt-1">Add your first waste disposal record to start tracking emissions.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr>
                {["Waste type", "Facility", "Disposal route", "Weight (t)", "CO2e (tCO2e)", "Date", "EWC", ""].map((h) => (
                  <th key={h} className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide first:pl-6 last:pr-6">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {records.map((r) => {
                const route = DISPOSAL_ROUTES.find((d) => d.value === r.disposalRoute);
                const hierarchyColor = HIERARCHY_COLORS[route?.hierarchy ?? "landfill"] ?? "";
                return (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 pl-6 pr-4 font-medium text-gray-900 max-w-[180px] truncate">
                      {r.wasteType}
                      {r.hazardous && <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">Hazardous</span>}
                    </td>
                    <td className="py-3 px-4 text-gray-600">{r.facility?.name ?? "-"}</td>
                    <td className="py-3 px-4">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${hierarchyColor}`}>
                        {route?.label ?? r.disposalRoute}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-900 tabular-nums">{Number(r.weightTonnes).toFixed(3)}</td>
                    <td className="py-3 px-4 text-gray-600 tabular-nums">
                      {r.co2eTonnes ? Number(r.co2eTonnes).toFixed(4) : "-"}
                    </td>
                    <td className="py-3 px-4 text-gray-500 tabular-nums">
                      {new Date(r.recordedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="py-3 px-4 text-gray-500 font-mono text-xs">{r.ewcCode ?? "-"}</td>
                    <td className="py-3 pl-4 pr-6">
                      <button onClick={() => handleDelete(r.id)}
                        className="h-7 w-7 rounded-lg hover:bg-red-50 flex items-center justify-center group">
                        <Trash2 className="h-3.5 w-3.5 text-gray-300 group-hover:text-red-500 transition-colors" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && (
        <AddRecordModal
          orgId={orgId}
          facilities={facilities}
          periods={periods}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load(); }}
        />
      )}
      {showBulk && (
        <BulkUploadModal orgId={orgId} onClose={() => setShowBulk(false)} onDone={load} />
      )}
    </div>
  );
}
