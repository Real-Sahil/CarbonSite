"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HIERARCHY, LIFECYCLE_MODULES, ROLE_LABELS, STATUS_LABELS } from "@/lib/pas2080";

type Role = keyof typeof ROLE_LABELS;
type Status = keyof typeof STATUS_LABELS;
type Level = (typeof HIERARCHY)[number]["level"];

type Plan = {
  valueChainRole: Role;
  carbonLeadName: string | null;
  baselineTco2e: number | null;
  baselineBasis: string | null;
  targetTco2e: number | null;
  modulesInScope: string[];
  notes: string | null;
};

type Opportunity = {
  id: string;
  title: string;
  description: string | null;
  hierarchyLevel: Level;
  workStage: string | null;
  lifecycleModules: string[];
  estimatedSavingTco2e: number | null;
  status: Status;
  decisionRationale: string | null;
  ownerName: string | null;
};

const input = "h-9 w-full rounded-md border border-[#E5E7EB] bg-white px-3 text-sm shadow-sm disabled:opacity-60";
const area = "w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm shadow-sm disabled:opacity-60";
const labelCls = "mb-1.5 block text-xs text-[#374151]";
const LEVEL_LABEL = Object.fromEntries(HIERARCHY.map((h) => [h.level, h.label])) as Record<Level, string>;

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message ?? `Request failed (${res.status})`);
  }
  return res.json();
}

const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

export function PlanForm({
  orgId, contractId, projectId, canEdit, plan,
}: { orgId: string; contractId: string; projectId: string; canEdit: boolean; plan: Plan | null }) {
  const router = useRouter();
  const [form, setForm] = useState({
    valueChainRole: plan?.valueChainRole ?? ("constructor" as Role),
    carbonLeadName: plan?.carbonLeadName ?? "",
    baselineTco2e: plan?.baselineTco2e?.toString() ?? "",
    baselineBasis: plan?.baselineBasis ?? "",
    targetTco2e: plan?.targetTco2e?.toString() ?? "",
    notes: plan?.notes ?? "",
  });
  const [modules, setModules] = useState<string[]>(plan?.modulesInScope ?? ["A1-A3", "A4", "A5"]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await send(`/api/orgs/${orgId}/contracts/${contractId}/projects/${projectId}/pas2080`, "PUT", {
        ...form,
        baselineTco2e: numOrNull(form.baselineTco2e),
        targetTco2e: numOrNull(form.targetTco2e),
        modulesInScope: LIFECYCLE_MODULES.filter((m) => modules.includes(m)),
      });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the plan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <fieldset disabled={!canEdit || busy} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="pas-role" className={labelCls}>Your role on this project</label>
          <select id="pas-role" className={input} value={form.valueChainRole} onChange={(e) => setForm({ ...form, valueChainRole: e.target.value as Role })}>
            {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="pas-lead" className={labelCls}>Carbon lead</label>
          <input id="pas-lead" className={input} maxLength={120} value={form.carbonLeadName} onChange={(e) => setForm({ ...form, carbonLeadName: e.target.value })} placeholder="Name of the accountable person" />
        </div>
        <div>
          <label htmlFor="pas-baseline" className={labelCls}>Baseline (tCO₂e)</label>
          <input id="pas-baseline" type="number" min={0} step="any" className={input} value={form.baselineTco2e} onChange={(e) => setForm({ ...form, baselineTco2e: e.target.value })} />
        </div>
        <div>
          <label htmlFor="pas-target" className={labelCls}>Target (tCO₂e)</label>
          <input id="pas-target" type="number" min={0} step="any" className={input} value={form.targetTco2e} onChange={(e) => setForm({ ...form, targetTco2e: e.target.value })} />
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <label htmlFor="pas-basis" className={labelCls}>How the baseline was set</label>
          <textarea id="pas-basis" rows={2} className={area} maxLength={2000} value={form.baselineBasis} onChange={(e) => setForm({ ...form, baselineBasis: e.target.value })} placeholder="e.g. Stage 2 reference design quantified with ICE v3 and DEFRA factors; excludes B6 as the asset has no operational energy" />
        </div>
        <fieldset className="sm:col-span-2 lg:col-span-4">
          <legend className={labelCls}>Life cycle modules in scope</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {LIFECYCLE_MODULES.map((m) => (
              <label key={m} className="flex items-center gap-1.5 text-sm text-[#111827]">
                <input
                  id={`pas-module-${m}`}
                  type="checkbox"
                  checked={modules.includes(m)}
                  onChange={(e) => setModules((cur) => (e.target.checked ? [...cur, m] : cur.filter((x) => x !== m)))}
                />
                {m}
              </label>
            ))}
          </div>
        </fieldset>
      </fieldset>
      {canEdit && (
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={busy}>{busy ? "Saving…" : "Save plan"}</Button>
          {saved && <p className="text-sm text-green-700">Saved</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </form>
  );
}

const EMPTY = {
  title: "",
  description: "",
  hierarchyLevel: "build_less" as Level,
  workStage: "",
  estimatedSavingTco2e: "",
  status: "identified" as Status,
  decisionRationale: "",
  ownerName: "",
};

export function OpportunityLog({
  orgId, contractId, projectId, canEdit, opportunities,
}: { orgId: string; contractId: string; projectId: string; canEdit: boolean; opportunities: Opportunity[] }) {
  const router = useRouter();
  const base = `/api/orgs/${orgId}/contracts/${contractId}/projects/${projectId}/pas2080/opportunities`;
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy("new");
    setError(null);
    try {
      await send(base, "POST", { ...draft, estimatedSavingTco2e: numOrNull(draft.estimatedSavingTco2e) });
      setDraft(EMPTY);
      setAdding(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the opportunity");
    } finally {
      setBusy(null);
    }
  }

  async function setStatus(o: Opportunity, status: Status) {
    let decisionRationale = o.decisionRationale;
    if (status === "rejected" && !decisionRationale) {
      decisionRationale = window.prompt(`Why was "${o.title}" rejected?`)?.trim() || null;
      if (!decisionRationale) return;
    }
    setBusy(o.id);
    setError(null);
    try {
      await send(`${base}/${o.id}`, "PATCH", { status, decisionRationale });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the opportunity");
    } finally {
      setBusy(null);
    }
  }

  async function remove(o: Opportunity) {
    if (!window.confirm(`Remove "${o.title}" from the log?`)) return;
    setBusy(o.id);
    try {
      await send(`${base}/${o.id}`, "DELETE");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the opportunity");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {opportunities.length === 0 ? (
        <p className="text-sm text-[#374151]">
          Nothing logged yet. Start with the highest levels: could the need be met without building, or with less?
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-[#E5E7EB] text-left text-xs text-[#374151]">
                <th className="py-2 pr-3 font-normal">Opportunity</th>
                <th className="py-2 pr-3 font-normal">Hierarchy</th>
                <th className="py-2 pr-3 font-normal">Stage</th>
                <th className="py-2 pr-3 text-right font-normal">Saving (tCO₂e)</th>
                <th className="py-2 pr-3 font-normal">Status</th>
                {canEdit && <th className="py-2 font-normal"><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {opportunities.map((o) => (
                <tr key={o.id} className="border-b border-[#F3F4F6] align-top">
                  <td className="py-2.5 pr-3">
                    <p className="font-medium text-[#111827]">{o.title}</p>
                    {o.description && <p className="text-xs text-[#6B7280]">{o.description}</p>}
                    {o.decisionRationale && <p className="mt-1 text-xs text-[#374151]">Decision: {o.decisionRationale}</p>}
                    {o.ownerName && <p className="text-xs text-[#6B7280]">Owner: {o.ownerName}</p>}
                  </td>
                  <td className="py-2.5 pr-3 text-[#374151]">{LEVEL_LABEL[o.hierarchyLevel]}</td>
                  <td className="py-2.5 pr-3 text-[#374151]">{o.workStage ?? ""}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{o.estimatedSavingTco2e != null ? o.estimatedSavingTco2e.toLocaleString("en-GB") : ""}</td>
                  <td className="py-2.5 pr-3">
                    {canEdit ? (
                      <select
                        id={`pas-status-${o.id}`}
                        aria-label={`Status of ${o.title}`}
                        className="h-8 rounded-md border border-[#E5E7EB] bg-white px-2 text-sm"
                        value={o.status}
                        disabled={busy === o.id}
                        onChange={(e) => setStatus(o, e.target.value as Status)}
                      >
                        {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    ) : (
                      STATUS_LABELS[o.status]
                    )}
                  </td>
                  {canEdit && (
                    <td className="py-2.5 text-right">
                      {(o.status === "identified" || o.status === "under_review") && (
                        <button type="button" onClick={() => remove(o)} className="text-xs text-[#374151] underline underline-offset-2 hover:text-red-600" disabled={busy === o.id}>
                          Remove
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canEdit && !adding && (
        <div>
          <Button type="button" size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Log an opportunity
          </Button>
        </div>
      )}

      {canEdit && adding && (
        <form onSubmit={add} className="grid gap-4 rounded-[10px] border border-[#E5E7EB] p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label htmlFor="opp-title" className={labelCls}>Opportunity</label>
            <input id="opp-title" required maxLength={200} className={input} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Retain and strengthen the existing culvert" />
          </div>
          <div>
            <label htmlFor="opp-level" className={labelCls}>Hierarchy level</label>
            <select id="opp-level" className={input} value={draft.hierarchyLevel} onChange={(e) => setDraft({ ...draft, hierarchyLevel: e.target.value as Level })}>
              {HIERARCHY.map((h) => <option key={h.level} value={h.level}>{h.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="opp-stage" className={labelCls}>Work stage</label>
            <input id="opp-stage" maxLength={80} className={input} value={draft.workStage} onChange={(e) => setDraft({ ...draft, workStage: e.target.value })} placeholder="e.g. RIBA 2 / Options" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="opp-desc" className={labelCls}>Description</label>
            <input id="opp-desc" maxLength={4000} className={input} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </div>
          <div>
            <label htmlFor="opp-saving" className={labelCls}>Estimated saving (tCO₂e)</label>
            <input id="opp-saving" type="number" min={0} step="any" className={input} value={draft.estimatedSavingTco2e} onChange={(e) => setDraft({ ...draft, estimatedSavingTco2e: e.target.value })} />
          </div>
          <div>
            <label htmlFor="opp-owner" className={labelCls}>Owner</label>
            <input id="opp-owner" maxLength={120} className={input} value={draft.ownerName} onChange={(e) => setDraft({ ...draft, ownerName: e.target.value })} />
          </div>
          <div>
            <label htmlFor="opp-status" className={labelCls}>Status</label>
            <select id="opp-status" className={input} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as Status })}>
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label htmlFor="opp-rationale" className={labelCls}>Decision reason{draft.status === "rejected" ? " (required)" : ""}</label>
            <input id="opp-rationale" maxLength={4000} required={draft.status === "rejected"} className={input} value={draft.decisionRationale} onChange={(e) => setDraft({ ...draft, decisionRationale: e.target.value })} />
          </div>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
            <Button type="submit" size="sm" disabled={busy === "new"}>{busy === "new" ? "Adding…" : "Add to log"}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setAdding(false); setDraft(EMPTY); }}>Cancel</Button>
          </div>
        </form>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
