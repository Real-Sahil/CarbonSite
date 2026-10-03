"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HORIZONS, SCENARIO_PRESETS, type DisclosureSections, type Scenario } from "@/lib/climate-disclosure";

const labelClass = "mb-1.5 block text-xs font-medium text-[#374151]";
const areaClass = "w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm shadow-sm disabled:opacity-60";

type NarrativeKey =
  | "governanceBoard" | "governanceManagement" | "strategyImpact" | "scenarioNarrative"
  | "riskIdentification" | "riskManagement" | "riskIntegration" | "metricsNarrative";

const GROUPS: { title: string; fields: { key: NarrativeKey; label: string; help: string }[] }[] = [
  {
    title: "Governance",
    fields: [
      { key: "governanceBoard", label: "Board oversight", help: "How the board (or equivalent body) oversees climate risks and opportunities, and how often it reviews them." },
      { key: "governanceManagement", label: "Management's role", help: "Which roles and committees assess and manage them, and how they report to the board." },
    ],
  },
  {
    title: "Strategy",
    fields: [
      { key: "strategyImpact", label: "Impact on the business", help: "How the risks and opportunities in your register affect your business, strategy and financial planning." },
      { key: "scenarioNarrative", label: "Resilience under the scenarios", help: "What the scenarios below mean for your strategy, and how resilient it is." },
    ],
  },
  {
    title: "Risk management",
    fields: [
      { key: "riskIdentification", label: "Identifying and assessing risks", help: "How you find climate risks and decide how significant they are." },
      { key: "riskManagement", label: "Managing risks", help: "How you respond to, prioritise and monitor them." },
      { key: "riskIntegration", label: "Integration", help: "How climate risk fits into your overall risk management process." },
    ],
  },
  {
    title: "Metrics and targets",
    fields: [
      { key: "metricsNarrative", label: "Metrics used", help: "The metrics you use to assess climate risks and opportunities, and how they inform decisions. Emissions and targets come from your published totals and targets." },
    ],
  },
];

const newId = () => `s${Math.random().toString(36).slice(2, 10)}`;

export function DisclosureForm({ orgId, canEdit, sections, approved }: { orgId: string; canEdit: boolean; sections: DisclosureSections; approved: boolean }) {
  const router = useRouter();
  const [scenarios, setScenarios] = useState<Scenario[]>(sections.scenarios);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const patch = (id: string, change: Partial<Scenario>) => setScenarios((list) => list.map((s) => (s.id === id ? { ...s, ...change } : s)));

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMsg(null);
    const f = new FormData(event.currentTarget);
    const str = (k: string) => String(f.get(k) ?? "").trim();
    const body: DisclosureSections = {
      governanceBoard: str("governanceBoard"),
      governanceManagement: str("governanceManagement"),
      horizons: { short: str("h-short"), medium: str("h-medium"), long: str("h-long") },
      strategyImpact: str("strategyImpact"),
      scenarioNarrative: str("scenarioNarrative"),
      scenarios: scenarios.filter((s) => s.name.trim()),
      riskIdentification: str("riskIdentification"),
      riskManagement: str("riskManagement"),
      riskIntegration: str("riskIntegration"),
      metricsNarrative: str("metricsNarrative"),
    };
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/climate-disclosure`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const fieldErrors = data?.details?.fieldErrors as Record<string, string[]> | undefined;
        setMsg({ ok: false, text: fieldErrors ? Object.values(fieldErrors).flat().join(" ") : data?.message ?? "Could not save." });
        return;
      }
      setMsg({ ok: true, text: data?.reopened ? "Saved. The statement is back in draft until it is approved again." : "Saved" });
      router.refresh();
    });
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-6 p-5">
      <p className="text-xs text-[#6B7280]">{approved ? "Saving changes returns the statement to draft until it is approved again." : "Save as you go; approval comes last."}</p>

      <Group group={GROUPS[0]} canEdit={canEdit} sections={sections} />
      <Group group={GROUPS[1]} canEdit={canEdit} sections={sections} only={["strategyImpact"]} extra={<Horizons canEdit={canEdit} sections={sections} />} />

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold text-[#111827]">Climate scenarios</legend>
        <p className="text-xs text-[#6B7280]">
          Use at least two, and include one consistent with limiting warming to 2°C or lower. Name the scenarios you actually used; the list offers well-known public sets as suggestions.
        </p>
        <datalist id="scenario-presets">{SCENARIO_PRESETS.map((p) => <option key={p} value={p} />)}</datalist>
        {scenarios.map((s) => (
          <div key={s.id} className="grid grid-cols-1 gap-3 rounded-md border border-[#E5E7EB] p-3 md:grid-cols-2">
            <div>
              <Label htmlFor={`sc-name-${s.id}`} className={labelClass}>Scenario</Label>
              <Input id={`sc-name-${s.id}`} list="scenario-presets" value={s.name} maxLength={120} disabled={!canEdit} onChange={(e) => patch(s.id, { name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor={`sc-source-${s.id}`} className={labelClass}>Source and outcome</Label>
              <Input id={`sc-source-${s.id}`} value={s.source} maxLength={300} disabled={!canEdit} placeholder="Publisher, version, warming outcome" onChange={(e) => patch(s.id, { source: e.target.value })} />
            </div>
            <div>
              <Label htmlFor={`sc-tr-${s.id}`} className={labelClass}>Transition effects</Label>
              <textarea id={`sc-tr-${s.id}`} rows={2} maxLength={3000} disabled={!canEdit} value={s.transition} className={areaClass} onChange={(e) => patch(s.id, { transition: e.target.value })} />
            </div>
            <div>
              <Label htmlFor={`sc-ph-${s.id}`} className={labelClass}>Physical effects</Label>
              <textarea id={`sc-ph-${s.id}`} rows={2} maxLength={3000} disabled={!canEdit} value={s.physical} className={areaClass} onChange={(e) => patch(s.id, { physical: e.target.value })} />
            </div>
            <div className="flex items-center justify-between md:col-span-2">
              <label className="flex items-center gap-2 text-sm text-[#374151]">
                <input type="checkbox" checked={s.lowCarbon} disabled={!canEdit} onChange={(e) => patch(s.id, { lowCarbon: e.target.checked })} />
                Consistent with 2°C or lower
              </label>
              {canEdit && (
                <Button type="button" variant="outline" size="sm" onClick={() => setScenarios((l) => l.filter((x) => x.id !== s.id))}>Remove</Button>
              )}
            </div>
          </div>
        ))}
        {canEdit && scenarios.length < 10 && (
          <div>
            <Button type="button" variant="outline" size="sm" onClick={() => setScenarios((l) => [...l, { id: newId(), name: "", source: "", lowCarbon: false, transition: "", physical: "" }])}>
              Add a scenario
            </Button>
          </div>
        )}
      </fieldset>

      <Group group={{ ...GROUPS[1], title: "Strategy: resilience" }} canEdit={canEdit} sections={sections} only={["scenarioNarrative"]} />
      <Group group={GROUPS[2]} canEdit={canEdit} sections={sections} />
      <Group group={GROUPS[3]} canEdit={canEdit} sections={sections} />

      {canEdit && (
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Saving…" : "Save statement"}</Button>
          {msg && <p className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</p>}
        </div>
      )}
    </form>
  );
}

function Group({
  group, canEdit, sections, extra, only,
}: {
  group: (typeof GROUPS)[number]; canEdit: boolean; sections: DisclosureSections; extra?: React.ReactNode; only?: NarrativeKey[];
}) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="text-sm font-semibold text-[#111827]">{group.title}</legend>
      {extra}
      {group.fields.filter((f) => !only || only.includes(f.key)).map((field) => (
        <div key={field.key}>
          <Label htmlFor={`cd-${field.key}`} className={labelClass}>{field.label}</Label>
          <textarea id={`cd-${field.key}`} name={field.key} rows={3} maxLength={10_000} disabled={!canEdit} defaultValue={sections[field.key]} className={areaClass} />
          <p className="mt-1 text-xs text-[#6B7280]">{field.help}</p>
        </div>
      ))}
    </fieldset>
  );
}

function Horizons({ canEdit, sections }: { canEdit: boolean; sections: DisclosureSections }) {
  return (
    <div>
      <p className={labelClass}>Time horizons: what do short, medium and long term mean for you?</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {HORIZONS.map((h) => (
          <div key={h.value}>
            <Label htmlFor={`cd-h-${h.value}`} className="mb-1 block text-xs text-[#6B7280]">{h.label}</Label>
            <Input id={`cd-h-${h.value}`} name={`h-${h.value}`} maxLength={200} disabled={!canEdit} defaultValue={sections.horizons[h.value]} placeholder="For example 0 to 2 years" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ApproveForm({ orgId, defaultBody }: { orgId: string; defaultBody: string | null }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function approve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMsg(null);
    const f = new FormData(event.currentTarget);
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/climate-disclosure/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ approvalBody: String(f.get("approvalBody") ?? ""), approvedOn: String(f.get("approvedOn") ?? "") }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMsg({ ok: false, text: data?.message ?? "Could not record the approval." });
        return;
      }
      setMsg({ ok: true, text: "Approval recorded" });
      router.refresh();
    });
  }

  return (
    <form onSubmit={approve} className="grid grid-cols-1 gap-4 p-5 md:grid-cols-3">
      <div className="md:col-span-2">
        <Label htmlFor="cd-approval-body" className={labelClass}>Approved by</Label>
        <Input id="cd-approval-body" name="approvalBody" required minLength={2} maxLength={200} defaultValue={defaultBody ?? "Board of directors"} />
      </div>
      <div>
        <Label htmlFor="cd-approved-on" className={labelClass}>Date approved</Label>
        <Input id="cd-approved-on" name="approvedOn" type="date" required />
      </div>
      <div className="flex items-center gap-3 md:col-span-3">
        <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Recording…" : "Record approval"}</Button>
        {msg && <p className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</p>}
      </div>
    </form>
  );
}
