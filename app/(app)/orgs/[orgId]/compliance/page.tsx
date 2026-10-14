"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { ShieldCheck, Plus, ChevronDown, ChevronUp, ExternalLink, User, ListChecks, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField, fieldClass } from "@/components/forms/form-kit";

interface ComplianceRecord {
  id: string;
  framework: string;
  reportingYear: number;
  status: string;
  dueDate: string | null;
  submittedAt: string | null;
  notes: string | null;
  owner: string | null;
  actionSteps: string | null;
  externalLink: string | null;
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
  draft:       { label: "Draft",       cls: "bg-[#F9FAFC] text-[#41505F]" },
  in_progress: { label: "In progress", cls: "bg-amber-100 text-amber-700" },
  submitted:   { label: "Submitted",   cls: "bg-[#F9FAFC] text-[#41505F]" },
  verified:    { label: "Verified",    cls: "bg-green-100 text-green-700" },
};

export default function CompliancePage() {
  const params = useParams<{ orgId: string }>();
  const orgId = params.orgId;
  const [records, setRecords] = useState<ComplianceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    framework: "SECR",
    reportingYear: new Date().getFullYear() - 1,
    status: "draft",
    dueDate: "",
    notes: "",
    owner: "",
    actionSteps: "",
    externalLink: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/orgs/${orgId}/compliance`);
    if (res.ok) {
      const d = await res.json();
      setRecords(d.data);
    }
    setLoading(false);
  }, [orgId]);

   
  useEffect(() => { load(); }, [load]);

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
          owner: form.owner || undefined,
          actionSteps: form.actionSteps || undefined,
          externalLink: form.externalLink || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.message ?? "Could not save.");
        return;
      }
      setShowAdd(false);
      setForm({
        framework: "SECR",
        reportingYear: new Date().getFullYear() - 1,
        status: "draft",
        dueDate: "",
        notes: "",
        owner: "",
        actionSteps: "",
        externalLink: "",
      });
      load();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = fieldClass;

  const hasGuidance = (r: ComplianceRecord) =>
    r.notes || r.owner || r.actionSteps || r.externalLink;

  return (
    <div className="p-8 max-w-5xl mx-auto bg-[#F9FAFC]">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl text-[#131d29] tracking-tight">Compliance</h1>
          <p className="text-sm text-[#5B6A78] mt-1">Track regulatory and framework disclosure obligations, owners, and next steps.</p>
        </div>
        <Button
          onClick={() => setShowAdd(!showAdd)}
        >
          <Plus className="h-4 w-4" />
          Add framework
        </Button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="rounded-xl border border-[#E3E8EE] bg-white p-6 mb-6">
          <h2 className="text-sm font-semibold text-[#131d29] mb-4">Track a compliance obligation</h2>
          <form onSubmit={handleSave} className="grid grid-cols-2 gap-4">
            <FormField label="Framework" htmlFor="f-framework" span={2}>
              <select id="f-framework" value={form.framework} onChange={(e) => setForm((f) => ({ ...f, framework: e.target.value }))} className={inputCls}>
                {FRAMEWORKS.map((fw) => <option key={fw.value} value={fw.value}>{fw.label}</option>)}
              </select>
            </FormField>
            <FormField label="Reporting year" htmlFor="f-reporting-year">
              <input id="f-reporting-year" type="number" required min={2000} max={2100} value={form.reportingYear}
                onChange={(e) => setForm((f) => ({ ...f, reportingYear: Number(e.target.value) }))} className={inputCls} />
            </FormField>
            <FormField label="Status" htmlFor="f-status">
              <select id="f-status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className={inputCls}>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </FormField>
            <FormField label="Due date" htmlFor="f-due-date" optional>
              <input id="f-due-date" type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} className={inputCls} />
            </FormField>
            <FormField label="Owner" htmlFor="f-owner" optional>
              <input id="f-owner"
                type="text"
                placeholder="e.g. Jane Smith / Finance team"
                value={form.owner}
                onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
                className={inputCls}
              />
            </FormField>
            <FormField label="Guidance link" htmlFor="f-guidance-link" optional>
              <input id="f-guidance-link"
                type="url"
                placeholder="https://..."
                value={form.externalLink}
                onChange={(e) => setForm((f) => ({ ...f, externalLink: e.target.value }))}
                className={inputCls}
              />
            </FormField>
            <FormField label="Notes" htmlFor="f-notes" span={2} optional>
              <textarea id="f-notes" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className={`${inputCls} resize-none`} />
            </FormField>
            <FormField label="Action steps" htmlFor="f-action-steps" span={2} optional>
              <textarea id="f-action-steps"
                rows={3}
                placeholder="e.g. 1. Gather scope 1 data&#10;2. Request scope 2 invoices&#10;3. Submit to HMRC portal by deadline"
                value={form.actionSteps}
                onChange={(e) => setForm((f) => ({ ...f, actionSteps: e.target.value }))}
                className={`${inputCls} resize-none`}
              />
            </FormField>
            {error && <p className="col-span-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <div className="col-span-2 flex gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
              <button type="button" onClick={() => setShowAdd(false)}
                className="rounded-lg border border-[#E3E8EE] px-4 py-2 text-sm font-medium text-[#41505F] hover:bg-[#F9FAFC] transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Records table */}
      <div className="rounded-xl border border-[#E3E8EE] bg-white overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-[#5B6A78]">Loading...</div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-[#fff7ed] flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-[#c2400c]" />
            </div>
            <p className="text-sm font-medium text-[#41505F]">No compliance records</p>
            <p className="text-xs text-[#5B6A78] mt-1">Add your first regulatory framework to start tracking obligations.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-[#E3E8EE]">
              <tr>
                {["Framework", "Year", "Status", "Owner", "Due date", "Submitted", ""].map((h) => (
                  <th key={h} className="py-3 px-4 text-left text-xs font-semibold text-[#5B6A78] uppercase tracking-wide first:pl-6">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E8EE]">
              {records.map((r) => {
                const sc = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.draft;
                const isExpanded = expandedId === r.id;
                const showExpander = hasGuidance(r);
                return (
                  <>
                    <tr key={r.id} className={`transition-colors ${isExpanded ? "bg-[#F9FAFC]" : "hover:bg-[#F9FAFC]"}`}>
                      <td className="py-3 pl-6 pr-4 font-medium text-[#131d29]">
                        {FRAMEWORKS.find((f) => f.value === r.framework)?.label.split(" (")[0] ?? r.framework}
                      </td>
                      <td className="py-3 px-4 text-[#41505F] tabular-nums">{r.reportingYear}</td>
                      <td className="py-3 px-4">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${sc.cls}`}>{sc.label}</span>
                      </td>
                      <td className="py-3 px-4 text-[#5B6A78] max-w-[140px] truncate" title={r.owner ?? undefined}>
                        {r.owner ? (
                          <span className="inline-flex items-center gap-1">
                            <User className="h-3 w-3 shrink-0" />
                            {r.owner}
                          </span>
                        ) : (
                          <span className="text-[#5B6A78]">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-[#5B6A78] tabular-nums">
                        {r.dueDate ? new Date(r.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "-"}
                      </td>
                      <td className="py-3 px-4 text-[#5B6A78] tabular-nums">
                        {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "-"}
                      </td>
                      <td className="py-3 px-4 pr-6">
                        {showExpander && (
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : r.id)}
                            className="inline-flex items-center gap-1 text-xs text-[#5B6A78] hover:text-[#41505F] transition-colors"
                            aria-label={isExpanded ? "Collapse guidance" : "Show guidance"}
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            <span>{isExpanded ? "Hide" : "Guidance"}</span>
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* Expanded guidance row */}
                    {isExpanded && (
                      <tr key={`${r.id}-detail`} className="bg-[#F9FAFC]">
                        <td colSpan={7} className="px-6 pb-5 pt-0">
                          <div className="rounded-lg border border-[#E3E8EE] bg-white p-4 grid gap-4 md:grid-cols-2">
                            {r.notes && (
                              <div>
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <FileText className="h-3.5 w-3.5 text-[#5B6A78]" />
                                  <span className="text-xs font-semibold text-[#5B6A78] uppercase tracking-wide">Notes</span>
                                </div>
                                <p className="text-sm text-[#41505F] whitespace-pre-line leading-relaxed">{r.notes}</p>
                              </div>
                            )}
                            {r.actionSteps && (
                              <div>
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <ListChecks className="h-3.5 w-3.5 text-[#5B6A78]" />
                                  <span className="text-xs font-semibold text-[#5B6A78] uppercase tracking-wide">Action steps</span>
                                </div>
                                <p className="text-sm text-[#41505F] whitespace-pre-line leading-relaxed">{r.actionSteps}</p>
                              </div>
                            )}
                            {r.externalLink && (
                              <div className="md:col-span-2">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <ExternalLink className="h-3.5 w-3.5 text-[#5B6A78]" />
                                  <span className="text-xs font-semibold text-[#5B6A78] uppercase tracking-wide">Guidance link</span>
                                </div>
                                <a
                                  href={r.externalLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-[#c2400c] hover:underline inline-flex items-center gap-1"
                                >
                                  {r.externalLink}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Framework reference */}
      <div className="mt-6 rounded-xl border border-[#E3E8EE] bg-white p-5">
        <button
          className="flex items-center justify-between w-full text-sm font-semibold text-[#131d29]"
          onClick={(e) => (e.currentTarget.nextElementSibling as HTMLElement).classList.toggle("hidden")}
        >
          Regulatory framework reference (UK)
          <ChevronDown className="h-4 w-4 text-[#5B6A78]" />
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
            <div key={fw.name} className="rounded-lg bg-[#F9FAFC] p-3">
              <p className="text-xs font-semibold text-[#41505F]">{fw.name}</p>
              <p className="text-xs text-[#5B6A78] mt-0.5 leading-relaxed">{fw.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
