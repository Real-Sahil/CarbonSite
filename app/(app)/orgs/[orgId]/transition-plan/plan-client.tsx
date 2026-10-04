"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PlanFields } from "@/lib/transition-plan";
import { FormField } from "@/components/forms/form-kit";

const labelClass = "mb-1.5 block text-xs font-medium text-[#374151]";
const areaClass = "w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm shadow-sm disabled:opacity-60";

const FIELDS: { key: keyof PlanFields; label: string; help: string }[] = [
  { key: "ambition", label: "Ambition", help: "What the organisation commits to, in its own words, and the scope it covers." },
  { key: "strategy", label: "Strategy and financial planning", help: "How the plan feeds the business strategy, budgets and investment decisions." },
  { key: "lockedInEmissions", label: "Locked-in emissions", help: "Emissions committed by existing assets and products (plant, fleet, buildings, long contracts) and how the plan handles them." },
  { key: "engagement", label: "Engagement", help: "How you work with suppliers, customers, peers and government to deliver the plan." },
  { key: "governance", label: "Governance", help: "Who oversees delivery, how progress reaches the board, and any link to pay." },
];

export function PlanForm({ orgId, canEdit, plan, currency }: { orgId: string; canEdit: boolean; plan: PlanFields | null; currency: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMsg(null);
    const f = new FormData(event.currentTarget);
    const str = (k: string) => String(f.get(k) ?? "").trim() || null;
    const num = (k: string) => (str(k) == null ? null : Number(str(k)));
    const body = {
      ambition: str("ambition"),
      strategy: str("strategy"),
      lockedInEmissions: str("lockedInEmissions"),
      engagement: str("engagement"),
      governance: str("governance"),
      netZeroYear: num("netZeroYear"),
      capexPlanned: num("capexPlanned"),
      opexPlanned: num("opexPlanned"),
      currency: str("currency") ?? currency,
      taxonomyAlignedCapexPct: num("taxonomyAlignedCapexPct"),
    };
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/transition-plan`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const fieldErrors = data?.details?.fieldErrors as Record<string, string[]> | undefined;
        setMsg({ ok: false, text: fieldErrors ? Object.values(fieldErrors).flat().join(" ") : data?.message ?? "Could not save the plan." });
        return;
      }
      setMsg({ ok: true, text: data?.reopened ? "Saved. The plan is back in draft until it is approved again." : "Saved" });
      router.refresh();
    });
  }

  return (
    <form onSubmit={save} className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
      {FIELDS.map((field) => (
        <div key={field.key} className="md:col-span-2">
          <Label htmlFor={`tp-${field.key}`} className={labelClass}>{field.label}</Label>
          <textarea
            id={`tp-${field.key}`}
            name={field.key}
            rows={3}
            maxLength={10_000}
            disabled={!canEdit}
            defaultValue={(plan?.[field.key] as string | null) ?? ""}
            className={areaClass}
          />
          <p className="mt-1 text-xs text-[#6B7280]">{field.help}</p>
        </div>
      ))}
      <FormField label="Net zero year" htmlFor="tp-netZeroYear" optional>
        <Input id="tp-netZeroYear" name="netZeroYear" type="number" min={2025} max={2070} disabled={!canEdit} defaultValue={plan?.netZeroYear ?? ""} />
      </FormField>
      <FormField label="Currency" htmlFor="tp-currency" optional>
        <Input id="tp-currency" name="currency" maxLength={3} disabled={!canEdit} defaultValue={currency} />
      </FormField>
      <FormField label="Planned capital spend" htmlFor="tp-capex" optional>
        <Input id="tp-capex" name="capexPlanned" type="number" min={0} step="any" disabled={!canEdit} defaultValue={plan?.capexPlanned ?? ""} />
      </FormField>
      <FormField label="Planned operating spend" htmlFor="tp-opex" optional>
        <Input id="tp-opex" name="opexPlanned" type="number" min={0} step="any" disabled={!canEdit} defaultValue={plan?.opexPlanned ?? ""} />
      </FormField>
      <FormField label="EU Taxonomy-aligned capex (%)" htmlFor="tp-taxonomy" hint="Leave blank if the Taxonomy does not apply to you." optional>
        <Input id="tp-taxonomy" name="taxonomyAlignedCapexPct" type="number" min={0} max={100} step="any" disabled={!canEdit} defaultValue={plan?.taxonomyAlignedCapexPct ?? ""} />
      </FormField>
      {canEdit && (
        <div className="flex items-center gap-3 md:col-span-2">
          <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Saving…" : "Save plan"}</Button>
          {msg && <p className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</p>}
        </div>
      )}
    </form>
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
      const res = await fetch(`/api/orgs/${orgId}/transition-plan/approve`, {
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
      <FormField label="Approved by" htmlFor="tp-approval-body" span={2}>
        <Input id="tp-approval-body" name="approvalBody" required minLength={2} maxLength={200} defaultValue={defaultBody ?? "Board of directors"} />
      </FormField>
      <FormField label="Date approved" htmlFor="tp-approved-on">
        <Input id="tp-approved-on" name="approvedOn" type="date" required />
      </FormField>
      <div className="flex items-center gap-3 md:col-span-3">
        <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Recording…" : "Record approval"}</Button>
        {msg && <p className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</p>}
      </div>
    </form>
  );
}
