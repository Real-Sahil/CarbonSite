"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Scatter } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PathwayPoint, PlanFields } from "@/lib/transition-plan";

const labelClass = "mb-1.5 block text-xs font-medium text-[#374151]";
const areaClass = "w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm shadow-sm disabled:opacity-60";
const fmt = (v: unknown) => (v == null ? "-" : `${Number(v).toLocaleString("en-GB", { maximumFractionDigits: 0 })} tCO₂e`);

export function PathwayChart({ points }: { points: PathwayPoint[] }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
          <CartesianGrid stroke="#F3F4F6" vertical={false} />
          <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#6B7280" }} tickLine={false} axisLine={{ stroke: "#E5E7EB" }} minTickGap={12} />
          <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} tickLine={false} axisLine={false} width={56} />
          <Tooltip formatter={(v, name) => [fmt(v), String(name)]} contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#E5E7EB" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="linear" dataKey="reference" name="1.5°C benchmark" stroke="#16A34A" strokeDasharray="4 4" dot={false} />
          <Line type="linear" dataKey="target" name="Your target" stroke="#111827" dot={false} connectNulls />
          <Line type="stepAfter" dataKey="planned" name="Planned (scheduled initiatives)" stroke="#f97316" strokeWidth={2} dot={false} />
          <Scatter dataKey="actual" name="Published actual" fill="#2563EB" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

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
      <div>
        <Label htmlFor="tp-netZeroYear" className={labelClass}>Net zero year</Label>
        <Input id="tp-netZeroYear" name="netZeroYear" type="number" min={2025} max={2070} disabled={!canEdit} defaultValue={plan?.netZeroYear ?? ""} />
      </div>
      <div>
        <Label htmlFor="tp-currency" className={labelClass}>Currency</Label>
        <Input id="tp-currency" name="currency" maxLength={3} disabled={!canEdit} defaultValue={currency} />
      </div>
      <div>
        <Label htmlFor="tp-capex" className={labelClass}>Planned capital spend</Label>
        <Input id="tp-capex" name="capexPlanned" type="number" min={0} step="any" disabled={!canEdit} defaultValue={plan?.capexPlanned ?? ""} />
      </div>
      <div>
        <Label htmlFor="tp-opex" className={labelClass}>Planned operating spend</Label>
        <Input id="tp-opex" name="opexPlanned" type="number" min={0} step="any" disabled={!canEdit} defaultValue={plan?.opexPlanned ?? ""} />
      </div>
      <div>
        <Label htmlFor="tp-taxonomy" className={labelClass}>EU Taxonomy-aligned capex (%)</Label>
        <Input id="tp-taxonomy" name="taxonomyAlignedCapexPct" type="number" min={0} max={100} step="any" disabled={!canEdit} defaultValue={plan?.taxonomyAlignedCapexPct ?? ""} />
        <p className="mt-1 text-xs text-[#6B7280]">Leave blank if the Taxonomy does not apply to you.</p>
      </div>
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
      <div className="md:col-span-2">
        <Label htmlFor="tp-approval-body" className={labelClass}>Approved by</Label>
        <Input id="tp-approval-body" name="approvalBody" required minLength={2} maxLength={200} defaultValue={defaultBody ?? "Board of directors"} />
      </div>
      <div>
        <Label htmlFor="tp-approved-on" className={labelClass}>Date approved</Label>
        <Input id="tp-approved-on" name="approvedOn" type="date" required />
      </div>
      <div className="flex items-center gap-3 md:col-span-3">
        <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Recording…" : "Record approval"}</Button>
        {msg && <p className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</p>}
      </div>
    </form>
  );
}
