"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_KPIS, caseStudyChecks, type Kpi } from "@/lib/case-studies";

const labelClass = "mb-1.5 block text-xs font-medium text-[#374151]";
const areaClass = "w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm shadow-sm";
const selectClass = "h-9 w-full rounded-md border border-[#E5E7EB] bg-white px-2 text-sm shadow-sm";

type Study = {
  id: string; contractId: string | null; title: string; problem: string; solution: string; baseline: string;
  results: string; kpis: Kpi[]; assumptions: string; published: boolean;
};
const blank: Study = { id: "", contractId: null, title: "", problem: "", solution: "", baseline: "", results: "", kpis: [], assumptions: "", published: false };

export function CaseStudies({ orgId, canEdit, contracts, studies }: { orgId: string; canEdit: boolean; contracts: { id: string; name: string }[]; studies: Study[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Study | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const contractName = (id: string | null) => contracts.find((c) => c.id === id)?.name ?? "Company-wide";

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setMsg(null);
    const { id, ...body } = editing;
    start(async () => {
      try {
        const res = await fetch(id ? `/api/orgs/${orgId}/case-studies/${id}` : `/api/orgs/${orgId}/case-studies`, {
          method: id ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          const fe = data?.details?.fieldErrors as Record<string, string[]> | undefined;
          setMsg(fe ? Object.values(fe).flat().join(" ") : data?.message ?? "Could not save.");
          return;
        }
        setEditing(null);
        router.refresh();
      } catch {
        setMsg("Couldn't reach the server. Check your connection and try again.");
      }
    });
  }

  function remove(id: string) {
    start(async () => {
      try {
        await fetch(`/api/orgs/${orgId}/case-studies/${id}`, { method: "DELETE" });
        router.refresh();
      } catch {
        setMsg("Couldn't reach the server. Check your connection and try again.");
      }
    });
  }

  const set = (patch: Partial<Study>) => setEditing((e) => (e ? { ...e, ...patch } : e));
  const checks = editing ? caseStudyChecks(editing) : [];

  return (
    <div className="flex flex-col gap-4">
      {canEdit && !editing && (
        <div><Button type="button" size="sm" onClick={() => { setMsg(null); setEditing({ ...blank }); }}>Add a case study</Button></div>
      )}

      {editing && canEdit && (
        <form onSubmit={save} className="grid grid-cols-1 gap-4 rounded-[10px] border border-[#E5E7EB] bg-white p-5 md:grid-cols-2">
          <div>
            <Label htmlFor="cs-title" className={labelClass}>Title</Label>
            <Input id="cs-title" required minLength={2} maxLength={200} value={editing.title} onChange={(e) => set({ title: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="cs-contract" className={labelClass}>Contract</Label>
            <select id="cs-contract" className={selectClass} value={editing.contractId ?? ""} onChange={(e) => set({ contractId: e.target.value || null })}>
              <option value="">Company-wide</option>
              {contracts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {(["problem", "solution", "baseline", "results", "assumptions"] as const).map((k) => (
            <div key={k} className="md:col-span-2">
              <Label htmlFor={`cs-${k}`} className={labelClass}>
                {{ problem: "The problem", solution: "What we did", baseline: "What the results are measured against", results: "Results", assumptions: "Assumptions behind the figures (prices, rates)" }[k]}
              </Label>
              <textarea id={`cs-${k}`} rows={k === "baseline" || k === "assumptions" ? 2 : 3} maxLength={3000} className={areaClass} value={editing[k]} onChange={(e) => set({ [k]: e.target.value })} />
            </div>
          ))}
          <fieldset className="md:col-span-2">
            <legend className={labelClass}>Headline figures (up to {MAX_KPIS})</legend>
            <div className="flex flex-col gap-2">
              {editing.kpis.map((k, i) => (
                <div key={i} className="grid grid-cols-[1fr_120px_1fr_auto] gap-2">
                  <Input aria-label="Figure label" placeholder="Fuel saved" maxLength={60} value={k.label} onChange={(e) => set({ kpis: editing.kpis.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                  <Input aria-label="Figure value" placeholder="74%" maxLength={30} value={k.value} onChange={(e) => set({ kpis: editing.kpis.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} />
                  <Input aria-label="Figure note" placeholder="Note (optional)" maxLength={120} value={k.note} onChange={(e) => set({ kpis: editing.kpis.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)) })} />
                  <Button type="button" variant="outline" size="sm" onClick={() => set({ kpis: editing.kpis.filter((_, j) => j !== i) })}>Remove</Button>
                </div>
              ))}
              {editing.kpis.length < MAX_KPIS && (
                <div><Button type="button" variant="outline" size="sm" onClick={() => set({ kpis: [...editing.kpis, { label: "", value: "", note: "" }] })}>Add a figure</Button></div>
              )}
            </div>
          </fieldset>
          <ul className="md:col-span-2 flex flex-col gap-1 text-sm">
            {checks.map((c) => (
              <li key={c.id} className={c.ok ? "text-green-700" : "text-amber-700"}>{c.ok ? "Done" : "To do"}: {c.label}{c.ok ? "" : `. ${c.detail}`}</li>
            ))}
          </ul>
          <label className="flex items-center gap-2 text-sm text-[#374151] md:col-span-2">
            <input type="checkbox" checked={editing.published} onChange={(e) => set({ published: e.target.checked })} />
            Publish: show on the site noticeboard of its contract
          </label>
          <div className="flex items-center gap-3 md:col-span-2">
            <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
            {msg && <p className="text-sm text-red-600">{msg}</p>}
          </div>
        </form>
      )}

      {studies.length === 0 && !editing ? (
        <p className="rounded-[10px] border border-[#E5E7EB] bg-white px-5 py-8 text-sm text-[#374151]">No case studies yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {studies.map((s) => (
            <li key={s.id} className="rounded-[10px] border border-[#E5E7EB] bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[#111827]">{s.title}</p>
                  <p className="text-xs text-[#6B7280]">{contractName(s.contractId)} · {s.published ? "Published" : "Draft"}{s.kpis.length ? ` · ${s.kpis.length} figure${s.kpis.length === 1 ? "" : "s"}` : ""}</p>
                </div>
                {canEdit && (
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => { setMsg(null); setEditing(s); }}>Edit</Button>
                    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => remove(s.id)}>Delete</Button>
                  </div>
                )}
              </div>
              {s.results && <p className="mt-2 max-w-[75ch] text-sm text-[#374151]">{s.results}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
