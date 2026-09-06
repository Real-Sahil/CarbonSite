"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Droplets, Plus, X, Upload } from "lucide-react";

interface WaterRecord {
  id: string;
  metricType: "withdrawal" | "discharge" | "consumption";
  source: string;
  volumeM3: string;
  isWaterStressedArea: boolean;
  recordedAt: string;
  notes: string | null;
  facility: { id: string; name: string } | null;
}

interface Facility { id: string; name: string }
interface Period { id: string; label: string }

const METRIC_LABELS: Record<string, string> = {
  withdrawal: "Withdrawal",
  discharge: "Discharge",
  consumption: "Consumption",
};

const SOURCE_OPTIONS = [
  { value: "municipal_supply", label: "Municipal supply" },
  { value: "groundwater", label: "Groundwater" },
  { value: "surface_water", label: "Surface water" },
  { value: "rainwater_harvested", label: "Rainwater harvested" },
  { value: "recycled_reused", label: "Recycled / reused" },
  { value: "third_party_wastewater", label: "Third-party wastewater" },
  { value: "other", label: "Other" },
];

function AddRecordModal({
  orgId, facilities, periods, onClose, onSaved,
}: { orgId: string; facilities: Facility[]; periods: Period[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    facilityId: facilities[0]?.id ?? "",
    reportingPeriodId: periods[0]?.id ?? "",
    metricType: "withdrawal" as "withdrawal" | "discharge" | "consumption",
    source: "municipal_supply",
    volumeM3: "",
    recordedAt: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/water-records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facilityId: form.facilityId,
          reportingPeriodId: form.reportingPeriodId,
          metricType: form.metricType,
          source: form.source,
          volumeM3: Number(form.volumeM3),
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

  const inputCls = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#0ea5e9] focus:ring-2 focus:ring-[#0ea5e9]/15 disabled:opacity-50";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Add water record</h2>
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Metric</label>
              <select value={form.metricType}
                onChange={(e) => setForm((f) => ({ ...f, metricType: e.target.value as typeof form.metricType }))}
                className={inputCls}>
                <option value="withdrawal">Withdrawal</option>
                <option value="discharge">Discharge</option>
                <option value="consumption">Consumption</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Source</label>
              <select value={form.source}
                onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} className={inputCls}>
                {SOURCE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Volume (m3)</label>
              <input type="number" required min="0.001" step="0.001" value={form.volumeM3}
                onChange={(e) => setForm((f) => ({ ...f, volumeM3: e.target.value }))}
                className={inputCls} placeholder="1250.000" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
              <input type="date" required value={form.recordedAt}
                onChange={(e) => setForm((f) => ({ ...f, recordedAt: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Water has no GHG Protocol scope: this is a physical-quantity disclosure (CSRD ESRS E3), not a CO2e calculation.
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes <span className="text-gray-500">(optional)</span></label>
            <textarea rows={2} value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className={`${inputCls} resize-none`} />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={loading || !form.facilityId || !form.reportingPeriodId}
            className="w-full rounded-lg bg-[#0ea5e9] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0284c7] disabled:opacity-60 transition-colors">
            {loading ? "Saving..." : "Save water record"}
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
      const res = await fetch(`/api/orgs/${orgId}/water-records/bulk`, { method: "POST", body: formData });
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
          <h2 className="text-base font-semibold text-gray-900">Bulk upload water records</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <p className="text-xs text-gray-500">
            CSV columns: facilityId, reportingPeriodId, metricType, source, volumeM3, recordedAt, notes
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
            className="w-full rounded-lg bg-[#0ea5e9] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0284c7] disabled:opacity-60 transition-colors">
            {loading ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WaterPage() {
  const params = useParams<{ orgId: string }>();
  const orgId = params.orgId;
  const [records, setRecords] = useState<WaterRecord[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);

  async function load() {
    const [recordsRes, facilitiesRes, periodsRes] = await Promise.all([
      fetch(`/api/orgs/${orgId}/water-records`),
      fetch(`/api/orgs/${orgId}/facilities`),
      fetch(`/api/orgs/${orgId}/reporting-periods`),
    ]);
    if (recordsRes.ok) {
      const d = await recordsRes.json();
      setRecords(d.data);
      setTotals(d.totalsByMetricType);
    }
    if (facilitiesRes.ok) setFacilities(await facilitiesRes.json());
    if (periodsRes.ok) setPeriods((await periodsRes.json()).periods);
    setLoading(false);
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [orgId]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this water record?")) return;
    await fetch(`/api/orgs/${orgId}/water-records/${id}`, { method: "DELETE" });
    load();
  }

  const stressedM3 = records
    .filter((r) => r.isWaterStressedArea && r.metricType === "withdrawal")
    .reduce((sum, r) => sum + Number(r.volumeM3), 0);
  const withdrawalM3 = totals.withdrawal ?? 0;
  const stressedPct = withdrawalM3 > 0 ? Math.round((stressedM3 / withdrawalM3) * 100) : 0;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Water</h1>
          <p className="text-sm text-gray-500 mt-1">Track withdrawal, discharge and consumption for CSRD ESRS E3.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowBulk(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <Upload className="h-4 w-4" />
            Bulk upload
          </button>
          <button onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0ea5e9] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0284c7] transition-colors">
            <Plus className="h-4 w-4" />
            Add water record
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Withdrawal", value: (totals.withdrawal ?? 0).toFixed(1), unit: "m3" },
          { label: "Discharge", value: (totals.discharge ?? 0).toFixed(1), unit: "m3" },
          { label: "Consumption", value: (totals.consumption ?? 0).toFixed(1), unit: "m3" },
          { label: "In water-stressed areas", value: `${stressedPct}%`, unit: "of withdrawal" },
        ].map(({ label, value, unit }) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-1">{label}</div>
            <div className="text-2xl font-semibold text-gray-900 tabular-nums">{value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{unit}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">Loading...</div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-gray-50 flex items-center justify-center">
              <Droplets className="h-5 w-5 text-gray-500" />
            </div>
            <p className="text-sm font-medium text-gray-700">No water records</p>
            <p className="text-xs text-gray-500 mt-1">Add your first water record to start tracking ESRS E3 disclosures.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr>
                {["Metric", "Facility", "Source", "Volume (m3)", "Water-stressed", "Date", ""].map((h) => (
                  <th key={h} className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide first:pl-6 last:pr-6">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 pl-6 pr-4 font-medium text-gray-900">{METRIC_LABELS[r.metricType]}</td>
                  <td className="py-3 px-4 text-gray-600">{r.facility?.name ?? "-"}</td>
                  <td className="py-3 px-4 text-gray-600">
                    {SOURCE_OPTIONS.find((s) => s.value === r.source)?.label ?? r.source}
                  </td>
                  <td className="py-3 px-4 text-gray-900 tabular-nums">{Number(r.volumeM3).toFixed(3)}</td>
                  <td className="py-3 px-4">
                    {r.isWaterStressedArea ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Stressed</span>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-gray-500 tabular-nums">
                    {new Date(r.recordedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="py-3 pl-4 pr-6">
                    <button onClick={() => handleDelete(r.id)}
                      className="h-7 w-7 rounded-lg hover:bg-red-50 flex items-center justify-center group">
                      <X className="h-3.5 w-3.5 text-gray-300 group-hover:text-red-500 transition-colors" />
                    </button>
                  </td>
                </tr>
              ))}
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
