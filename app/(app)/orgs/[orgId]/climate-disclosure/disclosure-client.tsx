"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DisclosureSections } from "@/lib/climate-disclosure";

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
      { key: "scenarioNarrative", label: "Resilience under the scenarios", help: "What your TCFD scenarios mean for your strategy, and how resilient it is." },
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

export function DisclosureForm({ orgId, canEdit, sections, approved }: { orgId: string; canEdit: boolean; sections: DisclosureSections; approved: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMsg(null);
    const f = new FormData(event.currentTarget);
    const str = (k: string) => String(f.get(k) ?? "").trim();
    const body: DisclosureSections = {
      governanceBoard: str("governanceBoard"),
      governanceManagement: str("governanceManagement"),
      strategyImpact: str("strategyImpact"),
      scenarioNarrative: str("scenarioNarrative"),
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
      <Group group={GROUPS[1]} canEdit={canEdit} sections={sections} only={["strategyImpact"]} />

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
