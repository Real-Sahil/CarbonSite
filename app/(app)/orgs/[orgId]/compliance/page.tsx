"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ShieldCheck, Plus, ChevronDown } from "lucide-react";

interface ComplianceRecord {
  id: string;
  framework: string;
  reportingYear: number;
  status: string;
  dueDate: string | null;
  submittedAt: string | null;
  notes: string | null;
}

const FRAMEWORKS = [
  { value: "SECR",         label: "SECR (UK Streamlined Energy & Carbon Reporting)" },
  { value: "GHG_Protocol", label: "GHG Protocol Corporate Standard" },
  { value: "TCFD",         label: "TCFD (Task Force on Climate-related Disclosures)" },
  { value: "CDP",          label: "CDP Climate Disclosure" },
  { value: "SBTi",         label: "Science Based Targets initiative" },
  { value: "ISO_14064",    label: "ISO 14064-1 Organisational GHG" },
  { value: "ESOS",         label: "ESOS (UK Energy Savings Opportunity Scheme)" },
  { value: "ETS",          label: "UK ETS (Emissions Trading Scheme)" },
  { value: "Other",        label: "Other" },
];

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  draft:       { label: "Draft",       cls: "bg-gray-100 text-gray-600" },
  in_progress: { label: "In progress", cls: "bg-amber-100 text-amber-700" },
  submitted:   { label: "Submitted",   cls: "bg-blue-100 text-blue-700" },
  verified:    { label: "Verified",    cls: "bg-green-100 text-green-700" },
};

export default function CompliancePage() {
  const params = useParams<{ orgId: string }>();
  const orgId = params.orgId;
  const [records, setRecords] = useState<ComplianceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    framework: "SECR", reportingYear: new Date().getFullYear() - 1,
    status: "draft", dueDate: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch(`/api/orgs/${orgId}/compliance`);
    if (res.ok) {
      const d = await res.json();
      setRecords(d.data);
    }
    setLoading(false);
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [orgId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/compliance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          reportingYear: Number(form.reportingYear),
          dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
          notes: form.notes || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.message ?? "Could not save.");
        return;
      }
      setShowAdd(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/15 disabled:opacity-50";

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Compliance</h1>
          <p className="text-sm text-gray-500 mt-1">Track regulatory and framework disclosure obligations.</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#0EA5E9] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0284C7] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add framework
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Track a compliance obligation</h2>
          <form onSubmit={handleSave} className="grid grid-cols-2 gap-4">
            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Framework</label>
              <select value={form.framework} onChange={(e) => setForm((f) => ({ ...f, framework: e.target.value }))} className={inputCls}>
                {FRAMEWORKS.map((fw) => <option key={fw.value} value={fw.value}>{fw.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Reporting year</label>
              <input type="number" required min={2000} max={2100} value={form.reportingYear}
                onChange={(e) => setForm((f) => ({ ...f, reportingYear: Number(e.target.value) }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className={inputCls}>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Due date <span className="text-gray-400">(optional)</span></label>
              <input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes <span className="text-gray-400">(optional)</span></label>
              <textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className={`${inputCls} resize-none`} />
            </div>
            {error && <p className="col-span-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <div className="col-span-2 flex gap-3">
              <button type="submit" disabled={saving}
                className="rounded-lg bg-[#0EA5E9] px-4 py-2 text-sm font-medium text-white hover:bg-[#0284C7] disabled:opacity-60 transition-colors">
                {saving ? "Saving..." : "Save"}
              </button>
              <button type="button" onClick={() => setShowAdd(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Records table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-400">Loading...</div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-[#F0F9FF] flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-[#0EA5E9]" />
            </div>
            <p className="text-sm font-medium text-gray-700">No compliance records</p>
            <p className="text-xs text-gray-400 mt-1">Add your first regulatory framework to start tracking obligations.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr>
                {["Framework", "Year", "Status", "Due date", "Submitted"].map((h) => (
                  <th key={h} className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide first:pl-6">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {records.map((r) => {
                const sc = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.draft;
                return (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 pl-6 pr-4 font-medium text-gray-900">
                      {FRAMEWORKS.find((f) => f.value === r.framework)?.label.split(" (")[0] ?? r.framework}
                    </td>
                    <td className="py-3 px-4 text-gray-600 tabular-nums">{r.reportingYear}</td>
                    <td className="py-3 px-4">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${sc.cls}`}>{sc.label}</span>
                    </td>
                    <td className="py-3 px-4 text-gray-500 tabular-nums">
                      {r.dueDate ? new Date(r.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "-"}
                    </td>
                    <td className="py-3 px-4 text-gray-500 tabular-nums">
                      {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Framework reference */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
        <button
          className="flex items-center justify-between w-full text-sm font-semibold text-gray-900"
          onClick={(e) => (e.currentTarget.nextElementSibling as HTMLElement).classList.toggle("hidden")}
        >
          Regulatory framework reference (UK)
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </button>
        <div className="hidden mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { name: "SECR", desc: "Required for UK large companies and LLPs. Annual directors' report disclosure of energy use and emissions." },
            { name: "ESOS", desc: "Mandatory energy audits every 4 years for UK large organisations. Deadline: December 2023 (Phase 3)." },
            { name: "UK ETS", desc: "Applies to energy-intensive industries, aviation, and power generators. Annual allowance surrender." },
            { name: "TCFD", desc: "Mandatory for UK premium-listed companies and large private companies. Climate-related financial disclosures." },
            { name: "CDP",  desc: "Voluntary but increasingly expected by investors. Annual climate, water, and forest questionnaires." },
            { name: "SBTi", desc: "Science-based emissions reduction targets aligned with 1.5°C pathway. Near-term and net-zero targets." },
          ].map((fw) => (
            <div key={fw.name} className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs font-semibold text-gray-700">{fw.name}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{fw.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
