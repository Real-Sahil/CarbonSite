"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PROFILE_COLUMNS, type ProfileColumnKey, type ProfileRule, type ProfileSpec, type ProfileSummary, type SourceSystem } from "@/lib/imports/profiles";
import { PROFILE_TEMPLATES, templateFor } from "@/lib/imports/profile-templates";

type Category = { code: string; name: string; scope: number };
type RuleDraft = Omit<ProfileRule, "basis"> & { basis: "spend" | "quantity"; key: number };

const field = "h-8 rounded-md border border-[#E5E7EB] bg-white px-2 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#c2410c]/30";
const label = "text-xs text-[#374151] tracking-[-0.36px]";

let nextKey = 1;
const draft = (r: Partial<ProfileRule> = {}): RuleDraft => ({ action: "include", ...r, basis: r.basis ?? "spend", key: nextKey++ });

export function ProfileEditor({
  orgId,
  categories,
  initial,
}: {
  orgId: string;
  categories: Category[];
  initial?: { id: string; name: string; spec: ProfileSpec };
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [system, setSystem] = useState<SourceSystem>(initial?.spec.sourceSystem ?? "sap");
  const [columns, setColumns] = useState<Partial<Record<ProfileColumnKey, string>>>(initial?.spec.columns ?? {});
  const [dateFormat, setDateFormat] = useState(initial?.spec.dateFormat ?? "dmy");
  const [numberFormat, setNumberFormat] = useState(initial?.spec.numberFormat ?? "uk");
  const [currency, setCurrency] = useState(initial?.spec.defaultCurrency ?? "GBP");
  const [rules, setRules] = useState<RuleDraft[]>(() => (initial?.spec.rules ?? []).map((r) => draft(r)));
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [summary, setSummary] = useState<ProfileSummary | null>(null);
  const [busy, setBusy] = useState<"read" | "check" | "save" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const template = templateFor(system);
  const headerOptions = useMemo(() => [...new Set([...headers, ...Object.values(columns).filter((h): h is string => !!h)])], [headers, columns]);
  const categoryName = (code: string) => categories.find((c) => c.code === code)?.name ?? code;

  const spec = (): ProfileSpec => ({
    sourceSystem: system,
    columns: Object.fromEntries(Object.entries(columns).filter(([, v]) => v)) as ProfileSpec["columns"],
    dateFormat,
    numberFormat,
    defaultCurrency: currency.trim().toUpperCase(),
    rules: rules.map(({ key: _key, ...r }) => clean(r)),
  });

  async function post(form: FormData) {
    const res = await fetch(`/api/orgs/${orgId}/import-profiles/preview`, { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message ?? "Could not read the file.");
    return data;
  }

  async function readFile(f: File, sys: SourceSystem) {
    setBusy("read");
    setError(null);
    setSummary(null);
    try {
      const form = new FormData();
      form.append("file", f);
      form.append("sourceSystem", sys);
      const data = await post(form);
      setHeaders(data.headers);
      // Keep columns already chosen that exist in this file; fill the rest from the template.
      setColumns((prev) => {
        const kept = Object.fromEntries(Object.entries(prev).filter(([, h]) => h && data.headers.includes(h)));
        return { ...data.suggestedColumns, ...kept };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the file.");
    } finally {
      setBusy(null);
    }
  }

  async function check() {
    if (!file) return;
    setBusy("check");
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("sourceSystem", system);
      form.append("spec", JSON.stringify(spec()));
      const data = await post(form);
      setSummary(data.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not check the file.");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    setBusy("save");
    setError(null);
    try {
      const res = await fetch(initial ? `/api/orgs/${orgId}/import-profiles/${initial.id}` : `/api/orgs/${orgId}/import-profiles`, {
        method: initial ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, spec: spec() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? "Could not save the profile.");
      router.push(`/orgs/${orgId}/imports/profiles`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the profile.");
      setBusy(null);
    }
  }

  async function remove() {
    if (!initial || !window.confirm(`Delete the profile "${initial.name}"? Past imports keep the rules they were read with.`)) return;
    setBusy("delete");
    const res = await fetch(`/api/orgs/${orgId}/import-profiles/${initial.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push(`/orgs/${orgId}/imports/profiles`);
      router.refresh();
    } else {
      setError("Could not delete the profile.");
      setBusy(null);
    }
  }

  const update = (key: number, patch: Partial<RuleDraft>) => setRules((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-[#E5E7EB] bg-white p-5">
        <h2 className="text-sm font-semibold text-[#111827]">Export</h2>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="profile-name" className={label}>Profile name</label>
            <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="SAP purchase ledger" className="w-64" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="profile-system" className={label}>Source system</label>
            <select
              id="profile-system"
              value={system}
              onChange={(e) => {
                const s = e.target.value as SourceSystem;
                setSystem(s);
                if (file) void readFile(file, s);
              }}
              className={`${field} w-56`}
            >
              {PROFILE_TEMPLATES.map((t) => (
                <option key={t.sourceSystem} value={t.sourceSystem}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="profile-file" className={label}>Sample export (CSV or Excel)</label>
            <Input
              id="profile-file"
              type="file"
              accept=".csv,.xlsx,.xls"
              className="w-64 text-sm"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f) void readFile(f, system);
              }}
            />
          </div>
          {busy === "read" ? <Loader2 aria-label="Reading" className="mb-2 h-4 w-4 animate-spin text-[#6B7280]" /> : null}
        </div>
        <p className="mt-3 max-w-[75ch] text-xs text-[#6B7280]">
          {template.exportHint} Column names differ between versions and saved layouts, so check each column below against your file. The sample is read to check the mapping and is not stored.
        </p>
      </section>

      <section className="rounded-xl border border-[#E5E7EB] bg-white p-5">
        <h2 className="text-sm font-semibold text-[#111827]">Columns</h2>
        <p className="mt-1 text-xs text-[#6B7280]">Posting date is required, plus a ledger account or cost code, and a net amount or quantity.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PROFILE_COLUMNS.map((c) => (
            <div key={c.key} className="flex flex-col gap-1">
              <label htmlFor={`col-${c.key}`} className={label}>{c.label}{c.required ? " *" : ""}</label>
              <select
                id={`col-${c.key}`}
                value={columns[c.key] ?? ""}
                onChange={(e) => setColumns((prev) => ({ ...prev, [c.key]: e.target.value || undefined }))}
                className={field}
              >
                <option value="">Not in this export</option>
                {headerOptions.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="date-format" className={label}>Dates</label>
            <select id="date-format" value={dateFormat} onChange={(e) => setDateFormat(e.target.value as ProfileSpec["dateFormat"])} className={field}>
              <option value="dmy">31/12/2025 (day first)</option>
              <option value="mdy">12/31/2025 (month first)</option>
              <option value="ymd">2025-12-31</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="number-format" className={label}>Numbers</label>
            <select id="number-format" value={numberFormat} onChange={(e) => setNumberFormat(e.target.value as ProfileSpec["numberFormat"])} className={field}>
              <option value="uk">1,234.56</option>
              <option value="eu">1.234,56</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="currency" className={label}>Currency when the export has none</label>
            <Input id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} className="h-8 w-24" />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-[#E5E7EB] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[#111827]">Rules</h2>
            <p className="mt-1 max-w-[75ch] text-xs text-[#6B7280]">
              Match a ledger account, a cost code or both: <code>5100</code> exactly, <code>51*</code> by prefix, <code>5000-5099</code> as a range. The most specific rule wins. Lines no rule covers are left out of the import and listed, never guessed.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setRules((rs) => [...rs, draft()])}>
            <Plus aria-hidden="true" className="h-3.5 w-3.5" /> Add rule
          </Button>
        </div>
        {rules.length === 0 ? (
          <p className="mt-4 text-sm text-[#6B7280]">No rules yet. Check a sample export to see which accounts it holds.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="text-left text-xs text-[#6B7280]">
                  {["Account", "Cost code", "Action", "Category", "Basis", "Unit", "Industry code", "Fuel", "Site", "Note", ""].map((h) => (
                    <th key={h} className="px-1.5 pb-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => {
                  const off = r.action === "ignore";
                  return (
                    <tr key={r.key} className="border-t border-[#F3F4F6]">
                      <td className="px-1.5 py-1.5"><Input aria-label="Account" value={r.account ?? ""} onChange={(e) => update(r.key, { account: e.target.value })} className="h-8 w-24" /></td>
                      <td className="px-1.5 py-1.5"><Input aria-label="Cost code" value={r.costCode ?? ""} onChange={(e) => update(r.key, { costCode: e.target.value })} className="h-8 w-24" /></td>
                      <td className="px-1.5 py-1.5">
                        <select aria-label="Action" value={r.action} onChange={(e) => update(r.key, { action: e.target.value as RuleDraft["action"] })} className={field}>
                          <option value="include">Include</option>
                          <option value="ignore">Ignore</option>
                        </select>
                      </td>
                      <td className="px-1.5 py-1.5">
                        <select aria-label="Category" disabled={off} value={r.categoryCode ?? ""} onChange={(e) => update(r.key, { categoryCode: e.target.value || undefined })} className={`${field} w-56 disabled:opacity-40`}>
                          <option value="">Choose</option>
                          {categories.map((c) => (
                            <option key={c.code} value={c.code}>Scope {c.scope}: {c.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-1.5 py-1.5">
                        <select aria-label="Basis" disabled={off} value={r.basis} onChange={(e) => update(r.key, { basis: e.target.value as RuleDraft["basis"] })} className={`${field} disabled:opacity-40`}>
                          <option value="spend">Spend</option>
                          <option value="quantity">Quantity</option>
                        </select>
                      </td>
                      <td className="px-1.5 py-1.5"><Input aria-label="Unit" disabled={off || r.basis === "spend"} placeholder={r.basis === "quantity" ? "litres" : ""} value={r.unit ?? ""} onChange={(e) => update(r.key, { unit: e.target.value })} className="h-8 w-20" /></td>
                      <td className="px-1.5 py-1.5"><Input aria-label="Industry code" disabled={off} placeholder="23.6" value={r.industryCode ?? ""} onChange={(e) => update(r.key, { industryCode: e.target.value })} className="h-8 w-24" /></td>
                      <td className="px-1.5 py-1.5"><Input aria-label="Fuel" disabled={off} value={r.fuelType ?? ""} onChange={(e) => update(r.key, { fuelType: e.target.value })} className="h-8 w-24" /></td>
                      <td className="px-1.5 py-1.5"><Input aria-label="Site" disabled={off} value={r.facilityName ?? ""} onChange={(e) => update(r.key, { facilityName: e.target.value })} className="h-8 w-28" /></td>
                      <td className="px-1.5 py-1.5"><Input aria-label="Note" value={r.note ?? ""} onChange={(e) => update(r.key, { note: e.target.value })} className="h-8 w-32" /></td>
                      <td className="px-1.5 py-1.5">
                        <button type="button" aria-label="Remove rule" onClick={() => setRules((rs) => rs.filter((x) => x.key !== r.key))} className="rounded p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-red-600">
                          <Trash2 aria-hidden="true" className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-[#6B7280]">
              Spend lines are priced by spend-based factors, which need the supplier&apos;s industry code (UK SIC, NAICS or NAF). Site names must match a facility exactly.
            </p>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-[#E5E7EB] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[#111827]">Check against the sample</h2>
          <Button type="button" variant="outline" size="sm" disabled={!file || busy !== null} onClick={check} className="gap-1.5">
            {busy === "check" ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : null}
            Check rules
          </Button>
        </div>
        {!file ? <p className="mt-2 text-sm text-[#6B7280]">Choose a sample export above to see what these rules include.</p> : null}
        {summary ? (
          <div className="mt-4 flex flex-col gap-5">
            <p className="text-sm text-[#374151]">
              {summary.lines.toLocaleString("en-GB")} lines: <strong>{summary.included.toLocaleString("en-GB")}</strong> included, {summary.ignored.toLocaleString("en-GB")} ignored by rule,{" "}
              <span className={summary.needsAttention ? "text-amber-700" : undefined}>{summary.needsAttention.toLocaleString("en-GB")} left out and listed</span>.
            </p>
            {summary.byCategory.length ? (
              <table className="w-full max-w-xl text-sm">
                <thead>
                  <tr className="text-left text-xs text-[#6B7280]"><th className="pb-1 font-medium">Category</th><th className="pb-1 text-right font-medium">Lines</th><th className="pb-1 text-right font-medium">Net amount</th></tr>
                </thead>
                <tbody>
                  {summary.byCategory.map((c) => (
                    <tr key={c.categoryCode} className="border-t border-[#F3F4F6]">
                      <td className="py-1">{categoryName(c.categoryCode)}</td>
                      <td className="py-1 text-right tabular-nums">{c.lines}</td>
                      <td className="py-1 text-right tabular-nums">{c.netAmount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            {summary.unmatched.length ? (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">No rule yet, largest first</h3>
                <table className="mt-2 w-full max-w-3xl text-sm">
                  <tbody>
                    {summary.unmatched.map((u) => (
                      <tr key={`${u.account ?? ""}|${u.costCode ?? ""}`} className="border-t border-[#F3F4F6]">
                        <td className="py-1.5 font-mono text-xs">{[u.account, u.costCode].filter(Boolean).join(" / ")}</td>
                        <td className="py-1.5 text-[#6B7280]">{u.example}</td>
                        <td className="py-1.5 text-right tabular-nums">{u.lines} lines</td>
                        <td className="py-1.5 text-right tabular-nums">{u.netAmount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</td>
                        <td className="py-1.5 pl-3 text-right">
                          <button
                            type="button"
                            className="text-xs text-[#c2410c] hover:text-[#9a3412]"
                            onClick={() => setRules((rs) => [...rs, draft({ account: u.account, costCode: u.account ? undefined : u.costCode, note: u.example?.slice(0, 200) })])}
                          >
                            Add rule
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {error ? (
        <div className="flex items-start gap-1.5">
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={save} disabled={busy !== null || !name.trim()} className="gap-1.5">
          {busy === "save" ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : null}
          Save profile
        </Button>
        <Link href={`/orgs/${orgId}/imports/profiles`} className="text-sm text-[#374151] hover:text-[#111827]">Cancel</Link>
        {initial ? (
          <button type="button" onClick={remove} disabled={busy !== null} className="ml-auto text-sm text-red-600 hover:text-red-700">
            Delete profile
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Drop empty strings so optional fields validate as absent. */
function clean(r: Omit<RuleDraft, "key">): ProfileRule {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) {
    const t = typeof v === "string" ? v.trim() : v;
    if (t !== "" && t !== undefined) out[k] = t;
  }
  if (out.action === "ignore") delete out.categoryCode;
  return out as ProfileRule;
}
