"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  HORIZONS, RATING_LABELS, RISK_KINDS, RISK_STATUSES, inherentScore, ratingOf, residualScore, type RiskRow,
} from "@/lib/climate-disclosure";

const labelClass = "mb-1.5 block text-xs font-medium text-[#374151]";
const areaClass = "w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm shadow-sm";
const selectClass = "h-9 w-full rounded-md border border-[#E5E7EB] bg-white px-2 text-sm shadow-sm";
const TONE = {
  low: "bg-green-50 text-green-800 border-green-200",
  medium: "bg-amber-50 text-amber-800 border-amber-200",
  high: "bg-orange-50 text-orange-800 border-orange-200",
  very_high: "bg-red-50 text-red-700 border-red-200",
} as const;

function Score({ value }: { value: number | null }) {
  if (value == null) return <span className="text-xs text-[#6B7280]">Not assessed</span>;
  const r = ratingOf(value);
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${TONE[r]}`}>{value} · {RATING_LABELS[r]}</span>;
}

const kindLabel = (k: string) => RISK_KINDS.find((x) => x.value === k)?.label ?? k;
const horizonLabel = (h: string) => HORIZONS.find((x) => x.value === h)?.label ?? h;

export function RiskRegister({ orgId, canEdit, risks }: { orgId: string; canEdit: boolean; risks: RiskRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<RiskRow | "new" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMsg(null);
    const f = new FormData(event.currentTarget);
    const str = (k: string) => String(f.get(k) ?? "").trim() || null;
    const int = (k: string) => (str(k) == null ? null : Number(str(k)));
    const body = {
      kind: str("kind"),
      title: str("title") ?? "",
      description: str("description"),
      horizon: str("horizon"),
      inherentLikelihood: int("inherentLikelihood"),
      inherentImpact: int("inherentImpact"),
      residualLikelihood: int("residualLikelihood"),
      residualImpact: int("residualImpact"),
      mitigation: str("mitigation"),
      financialEffect: str("financialEffect"),
      ownerRole: str("ownerRole"),
      status: str("status") ?? "open",
    };
    const target = editing && editing !== "new" ? editing : null;
    startTransition(async () => {
      const res = await fetch(target ? `/api/orgs/${orgId}/climate-risks/${target.id}` : `/api/orgs/${orgId}/climate-risks`, {
        method: target ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const fieldErrors = data?.details?.fieldErrors as Record<string, string[]> | undefined;
        setMsg(fieldErrors ? Object.values(fieldErrors).flat().join(" ") : data?.message ?? "Could not save the risk.");
        return;
      }
      setEditing(null);
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await fetch(`/api/orgs/${orgId}/climate-risks/${id}`, { method: "DELETE" });
      router.refresh();
    });
  }

  const r = editing && editing !== "new" ? editing : null;
  const scale = (name: string, value: number | null | undefined, optional = false) => (
    <select name={name} defaultValue={value ?? ""} required={!optional} className={selectClass} aria-label={name}>
      {optional && <option value="">Not assessed</option>}
      {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
    </select>
  );

  return (
    <div>
      {risks.length === 0 ? (
        <p className="px-5 py-6 text-sm text-[#374151]">No risks or opportunities yet. Add the ones your organisation faces: physical (floods, heat), transition (policy, technology, market, reputation) and opportunities.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-[#F3F4F6] text-left text-xs text-[#6B7280]">
                <th className="px-5 py-2 font-medium">Risk or opportunity</th>
                <th className="px-3 py-2 font-medium">Horizon</th>
                <th className="px-3 py-2 font-medium">Before</th>
                <th className="px-3 py-2 font-medium">After</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {risks.map((x) => (
                <tr key={x.id} className="align-top">
                  <td className="px-5 py-3">
                    <p className="font-medium text-[#111827]">{x.title}</p>
                    <p className="text-xs text-[#6B7280]">{kindLabel(x.kind)}</p>
                  </td>
                  <td className="px-3 py-3 text-[#374151]">{horizonLabel(x.horizon)}</td>
                  <td className="px-3 py-3"><Score value={inherentScore(x)} /></td>
                  <td className="px-3 py-3"><Score value={residualScore(x)} /></td>
                  <td className="px-3 py-3 text-[#374151]">{RISK_STATUSES.find((s) => s.value === x.status)?.label ?? x.status}</td>
                  <td className="px-3 py-3 text-right">
                    {canEdit && (
                      <span className="flex justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => { setMsg(null); setEditing(x); }}>Edit</Button>
                        <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => remove(x.id)}>Delete</Button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canEdit && !editing && (
        <div className="border-t border-[#F3F4F6] px-5 py-4">
          <Button type="button" size="sm" onClick={() => { setMsg(null); setEditing("new"); }}>Add a risk or opportunity</Button>
        </div>
      )}

      {canEdit && editing && (
        <form key={r?.id ?? "new"} onSubmit={save} className="grid grid-cols-1 gap-4 border-t border-[#F3F4F6] p-5 md:grid-cols-3">
          <div className="md:col-span-2">
            <Label htmlFor="cr-title" className={labelClass}>Title</Label>
            <Input id="cr-title" name="title" required minLength={2} maxLength={200} defaultValue={r?.title ?? ""} />
          </div>
          <div>
            <Label htmlFor="cr-status" className={labelClass}>Status</Label>
            <select id="cr-status" name="status" defaultValue={r?.status ?? "open"} className={selectClass}>
              {RISK_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="cr-kind" className={labelClass}>Type</Label>
            <select id="cr-kind" name="kind" defaultValue={r?.kind ?? "physical_acute"} className={selectClass}>
              {RISK_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="cr-horizon" className={labelClass}>Horizon</Label>
            <select id="cr-horizon" name="horizon" defaultValue={r?.horizon ?? "medium"} className={selectClass}>
              {HORIZONS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
            </select>
          </div>
          <div className="md:col-span-3">
            <Label htmlFor="cr-description" className={labelClass}>Description</Label>
            <textarea id="cr-description" name="description" rows={2} maxLength={5000} defaultValue={r?.description ?? ""} className={areaClass} />
          </div>
          <div><Label className={labelClass}>Likelihood before response (1 to 5)</Label>{scale("inherentLikelihood", r?.inherentLikelihood ?? 3)}</div>
          <div><Label className={labelClass}>Impact before response (1 to 5)</Label>{scale("inherentImpact", r?.inherentImpact ?? 3)}</div>
          <div className="hidden md:block" />
          <div><Label className={labelClass}>Likelihood after response</Label>{scale("residualLikelihood", r?.residualLikelihood, true)}</div>
          <div><Label className={labelClass}>Impact after response</Label>{scale("residualImpact", r?.residualImpact, true)}</div>
          <div>
            <Label htmlFor="cr-owner" className={labelClass}>Owner (role or team)</Label>
            <Input id="cr-owner" name="ownerRole" maxLength={120} defaultValue={r?.ownerRole ?? ""} />
          </div>
          <div className="md:col-span-3">
            <Label htmlFor="cr-mitigation" className={labelClass}>Response</Label>
            <textarea id="cr-mitigation" name="mitigation" rows={2} maxLength={5000} defaultValue={r?.mitigation ?? ""} className={areaClass} />
          </div>
          <div className="md:col-span-3">
            <Label htmlFor="cr-financial" className={labelClass}>Financial effect (in your own words, with your currency)</Label>
            <textarea id="cr-financial" name="financialEffect" rows={2} maxLength={5000} defaultValue={r?.financialEffect ?? ""} className={areaClass} />
          </div>
          <div className="flex items-center gap-3 md:col-span-3">
            <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Saving…" : r ? "Save changes" : "Add"}</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
            {msg && <p className="text-sm text-red-600">{msg}</p>}
          </div>
        </form>
      )}
    </div>
  );
}
