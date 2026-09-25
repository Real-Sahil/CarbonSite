"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2 } from "lucide-react";
import { inputCls, labelCls } from "@/components/structured-forms/ms-fields";
import type { BillExtraction } from "@/lib/evidence/bill-extractor";

type Option = { id: string; label: string };
type Category = Option & { code: string; scope: number };
type Read = BillExtraction & { evidenceId: string; filename: string; method: string };

const NETWORK = "Couldn't reach the server. Check your connection and try again.";

/** Confidence dot: green high, amber check, red guess. */
function Confidence({ value }: { value: number | undefined }) {
  if (value == null) return null;
  const [cls, label] = value >= 0.8 ? ["bg-emerald-500", "High"] : value >= 0.5 ? ["bg-amber-400", "Check"] : ["bg-red-500", "Low"];
  return (
    <span className="ml-1 inline-flex items-center gap-1 text-[11px] font-normal text-[#6B7280]" title={`${Math.round(value * 100)}% confidence`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cls}`} aria-hidden /> {label}
    </span>
  );
}

export function AddFromBill({ orgId, periods, categories, facilities }: { orgId: string; periods: Option[]; categories: Category[]; facilities: Option[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"read" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [read, setRead] = useState<Read | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [form, setForm] = useState({ periodId: periods[0]?.id ?? "", categoryId: "", facilityId: "", amount: "", unit: "", date: "", supplier: "", fuelType: "", note: "" });

  async function upload(file: File) {
    setBusy("read");
    setError(null);
    setSaved(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/orgs/${orgId}/evidence/bill`, { method: "POST", body });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((d as { message?: string }).message ?? "Couldn't read that file.");
        return;
      }
      const r = d as Read;
      setRead(r);
      const cat = categories.find((c) => c.code === r.categoryCode);
      setForm((f) => ({
        ...f,
        categoryId: cat?.id ?? "",
        amount: r.amount ? String(r.amount.value) : "",
        unit: r.unit ?? "",
        date: r.periodEnd?.value ?? r.issueDate?.value ?? "",
        supplier: r.supplier?.value ?? "",
        fuelType: r.fuelType?.value ?? "",
        note: [r.invoiceNumber ? `Invoice ${r.invoiceNumber.value}` : "", r.periodStart && r.periodEnd ? `period ${r.periodStart.value} to ${r.periodEnd.value}` : ""].filter(Boolean).join(", "),
      }));
    } catch {
      setError(NETWORK);
    } finally {
      setBusy(null);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!read) return;
    setBusy("save");
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportingPeriodId: form.periodId,
          emissionCategoryId: form.categoryId,
          facilityId: form.facilityId || undefined,
          amount: Number(form.amount),
          unit: form.unit,
          activityDate: form.date || undefined,
          supplierName: form.supplier || undefined,
          fuelType: form.fuelType || undefined,
          sourceDescription: `${read.filename}${form.note ? ` (${form.note})` : ""}`.slice(0, 500),
          dataOrigin: "invoiced",
          reviewStatus: "in_review",
        }),
      });
      const d = (await res.json().catch(() => ({}))) as { id?: string; message?: string; code?: string };
      if (!res.ok || !d.id) {
        setError(d.message ?? "Couldn't save the record.");
        return;
      }
      const attach = await fetch(`/api/orgs/${orgId}/records/${d.id}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evidenceId: read.evidenceId }),
      });
      if (!attach.ok) {
        setError("The record was saved, but the bill couldn't be attached. Attach it from the records table.");
        return;
      }
      setSaved("Saved for review with the bill attached.");
      setRead(null);
      router.refresh();
    } catch {
      setError(NETWORK);
    } finally {
      setBusy(null);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="flex flex-col gap-4">
      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-[#D1D5DB] px-4 py-4 hover:bg-[#F9FAFB]">
        {busy === "read" ? <Loader2 className="h-5 w-5 animate-spin text-[#6B7280]" /> : <FileUp className="h-5 w-5 text-[#6B7280]" />}
        <span className="text-sm text-[#374151]">
          {busy === "read" ? "Reading the document. Photos can take up to a minute." : "Choose a utility bill or fuel receipt (PDF or photo, up to 10 MB)"}
        </span>
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={!!busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.target.value = "";
          }}
        />
      </label>

      {saved ? <p className="text-sm text-emerald-700">{saved}</p> : null}
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}

      {read ? (
        <form onSubmit={save} className="flex flex-col gap-4">
          {read.notes.length ? (
            <ul className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {read.notes.map((n) => <li key={n}>{n}</li>)}
            </ul>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="bill-cat" className={labelCls}>Category</label>
              <select id="bill-cat" required className={inputCls} value={form.categoryId} onChange={set("categoryId")}>
                <option value="">Choose a category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>Scope {c.scope}: {c.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="bill-amount" className={labelCls}>Amount<Confidence value={read.amount?.confidence} /></label>
              <input id="bill-amount" type="number" step="any" min="0" required className={inputCls} value={form.amount} onChange={set("amount")} />
              {read.amount?.source ? <p className="mt-1 truncate text-[11px] text-[#6B7280]" title={read.amount.source}>Read from: {read.amount.source}</p> : null}
              {read.alternatives.length ? (
                <p className="mt-1 text-[11px] text-[#6B7280]">
                  Also on the page:{" "}
                  {read.alternatives.slice(0, 5).map((v) => (
                    <button key={v} type="button" onClick={() => setForm({ ...form, amount: String(v) })} className="mr-1 underline underline-offset-2">
                      {v.toLocaleString("en-GB")}
                    </button>
                  ))}
                </p>
              ) : null}
            </div>
            <div>
              <label htmlFor="bill-unit" className={labelCls}>Unit</label>
              <input id="bill-unit" required className={inputCls} value={form.unit} onChange={set("unit")} />
            </div>
            <div>
              <label htmlFor="bill-period" className={labelCls}>Reporting period</label>
              <select id="bill-period" required className={inputCls} value={form.periodId} onChange={set("periodId")}>
                {periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="bill-date" className={labelCls}>Activity date<Confidence value={(read.periodEnd ?? read.issueDate)?.confidence} /></label>
              <input id="bill-date" type="date" className={inputCls} value={form.date} onChange={set("date")} />
            </div>
            <div>
              <label htmlFor="bill-site" className={labelCls}>Site</label>
              <select id="bill-site" className={inputCls} value={form.facilityId} onChange={set("facilityId")}>
                <option value="">No site</option>
                {facilities.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="bill-supplier" className={labelCls}>Supplier<Confidence value={read.supplier?.confidence} /></label>
              <input id="bill-supplier" className={inputCls} value={form.supplier} onChange={set("supplier")} />
            </div>
            {read.kind === "fuel" ? (
              <div>
                <label htmlFor="bill-fuel" className={labelCls}>Fuel<Confidence value={read.fuelType?.confidence} /></label>
                <input id="bill-fuel" className={inputCls} value={form.fuelType} onChange={set("fuelType")} />
              </div>
            ) : null}
            <div className={read.kind === "fuel" ? "" : "sm:col-span-2"}>
              <label htmlFor="bill-note" className={labelCls}>Reference</label>
              <input id="bill-note" className={inputCls} value={form.note} onChange={set("note")} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-md bg-[#111827] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
              {busy === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save for review
            </button>
            <button type="button" onClick={() => setRead(null)} className="text-sm text-[#6B7280]">Discard</button>
            <span className="text-xs text-[#6B7280]">Read by {read.method === "ocr" ? "text recognition" : "the PDF's text"}. The bill is kept as evidence on the record.</span>
          </div>
        </form>
      ) : null}
    </div>
  );
}
