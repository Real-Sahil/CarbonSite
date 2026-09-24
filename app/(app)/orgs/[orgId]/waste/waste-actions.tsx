"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Upload, Trash2, X } from "lucide-react";

interface Facility { id: string; name: string }
interface Period { id: string; label: string }

export const DISPOSAL_ROUTES = [
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

const WASTE_TEMPLATE_CSV = [
  "facilityId,reportingPeriodId,wasteType,disposalRoute,hazardous,weightTonnes,ewcCode,carrierName,carrierRegistration,transferNoteReference,destination,vehicleRegistration,recordedAt,notes",
  "facility-id-here,period-id-here,general_waste,landfill_mixed,false,0.5,20 03 01,Acme Waste Ltd,CBDU123456,WTN-0001,Permit EPR/AB1234CD,AB12 CDE,2024-01-15,Example note",
  "facility-id-here,period-id-here,construction_waste,recycling_mixed,false,1.2,17 01 01,,,,,,2024-01-20,",
].join("\n");

function AddRecordModal({
  orgId, facilities, periods, onClose, onSaved,
}: { orgId: string; facilities: Facility[]; periods: Period[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    facilityId: facilities[0]?.id ?? "",
    reportingPeriodId: periods[0]?.id ?? "",
    wasteType: "", disposalRoute: "recycling_mixed", hazardous: false,
    weightTonnes: "", ewcCode: "", carrierName: "",
    carrierRegistration: "", transferNoteReference: "", destination: "", vehicleRegistration: "",
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
          carrierRegistration: form.carrierRegistration || undefined,
          transferNoteReference: form.transferNoteReference || undefined,
          destination: form.destination || undefined,
          vehicleRegistration: form.vehicleRegistration || undefined,
          recordedAt: new Date(form.recordedAt).toISOString(),
          notes: form.notes || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError((d as { message?: string }).message ?? "Failed to save.");
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
              className="h-4 w-4 rounded border-gray-300 text-[#c2410c] focus:ring-[#c2410c]/30" />
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
          <p className="text-xs text-gray-500">
            Duty of care: record the carrier&apos;s registration and the transfer note (or consignment note for
            hazardous waste). Transfers without them show as gaps on the duty of care register.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Carrier registration</label>
              <input type="text" value={form.carrierRegistration} maxLength={40}
                onChange={(e) => setForm((f) => ({ ...f, carrierRegistration: e.target.value }))}
                className={inputCls} placeholder="CBDU123456" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Transfer or consignment note</label>
              <input type="text" value={form.transferNoteReference} maxLength={100}
                onChange={(e) => setForm((f) => ({ ...f, transferNoteReference: e.target.value }))}
                className={inputCls} placeholder="WTN-0001" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Receiving site or permit</label>
              <input type="text" value={form.destination} maxLength={200}
                onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
                className={inputCls} placeholder="Permit EPR/AB1234CD" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle registration</label>
              <input type="text" value={form.vehicleRegistration} maxLength={20}
                onChange={(e) => setForm((f) => ({ ...f, vehicleRegistration: e.target.value }))}
                className={inputCls} placeholder="AB12 CDE" />
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
            className="w-full rounded-lg bg-[#c2410c] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#9a3412] disabled:opacity-60 transition-colors">
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

  function downloadTemplate() {
    const blob = new Blob([WASTE_TEMPLATE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "waste-records-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/orgs/${orgId}/waste-records/bulk`, { method: "POST", body: formData });
      const data = await res.json();
      setResult(data);
      if (res.ok && (data as { created: number }).created > 0) onDone();
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
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-gray-700 mb-1">Required columns</p>
              <p className="text-xs text-gray-500 font-mono leading-relaxed">
                facilityId, reportingPeriodId, wasteType,<br />
                disposalRoute, hazardous, weightTonnes,<br />
                ewcCode, carrierName, carrierRegistration,<br />
                transferNoteReference, destination,<br />
                vehicleRegistration, recordedAt, notes
              </p>
            </div>
            <button type="button" onClick={downloadTemplate}
              className="shrink-0 flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors">
              <Upload className="h-3.5 w-3.5 rotate-180" />
              Template
            </button>
          </div>
          <input type="file" accept=".csv,.xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-xs file:font-medium" />
          {result && (
            <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-700">
              <p>{(result as { created: number; failed: number }).created} created, {(result as { created: number; failed: number }).failed} failed.</p>
              {(result as { errors: { row: number; message: string }[] }).errors.slice(0, 8).map((e, i) => (
                <p key={i} className="text-red-600 mt-1">Row {e.row}: {e.message}</p>
              ))}
            </div>
          )}
          <button onClick={handleUpload} disabled={!file || loading}
            className="w-full rounded-lg bg-[#c2410c] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#9a3412] disabled:opacity-60 transition-colors">
            {loading ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function WasteAddButtons({ orgId, facilities, periods }: {
  orgId: string; facilities: Facility[]; periods: Period[];
}) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);

  return (
    <>
      <div className="flex gap-2">
        <button onClick={() => setShowBulk(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
          <Upload className="h-4 w-4" />
          Bulk upload
        </button>
        <button onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#c2410c] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#9a3412] transition-colors">
          <Plus className="h-4 w-4" />
          Add waste record
        </button>
      </div>
      {showAdd && (
        <AddRecordModal
          orgId={orgId} facilities={facilities} periods={periods}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); router.refresh(); }}
        />
      )}
      {showBulk && (
        <BulkUploadModal
          orgId={orgId}
          onClose={() => setShowBulk(false)}
          onDone={() => { setShowBulk(false); router.refresh(); }}
        />
      )}
    </>
  );
}

export function DeleteWasteButton({ orgId, id }: { orgId: string; id: string }) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("Delete this waste record?")) return;
    await fetch(`/api/orgs/${orgId}/waste-records/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <button onClick={handleDelete} className="h-7 w-7 rounded-lg hover:bg-red-50 flex items-center justify-center group">
      <Trash2 className="h-3.5 w-3.5 text-gray-300 group-hover:text-red-500 transition-colors" />
    </button>
  );
}
