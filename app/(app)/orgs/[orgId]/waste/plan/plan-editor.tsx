"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormActions, FormError, FormField, FormSection, fieldClass } from "@/components/forms/form-kit";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PLAN_ROUTES, ROUTE_LABEL, type PlanLine } from "@/lib/waste/swmp";

type Plan = { responsiblePerson: string | null; principalContractor: string | null; clientName: string | null; targetDiversionPct: number | null; actions: string | null; nextReviewOn: string | null; lines: PlanLine[] };

export function PlanEditor({ orgId, projectId, plan, status, canEdit, canApprove }: { orgId: string; projectId: string; plan: Plan; status: string; canEdit: boolean; canApprove: boolean }) {
  const router = useRouter();
  const [lines, setLines] = useState<PlanLine[]>(plan.lines.length ? plan.lines : [{ wasteType: "", ewcCode: "", forecastTonnes: 0, plannedRoute: "recycle" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const base = `/api/orgs/${orgId}/waste/plans/${projectId}`;
  const setLine = (i: number, patch: Partial<PlanLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(null); setNote(null);
    const f = new FormData(e.currentTarget);
    const str = (k: string) => (String(f.get(k) ?? "").trim() || null);
    const target = str("target");
    const res = await fetch(base, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        responsiblePerson: str("responsiblePerson"), principalContractor: str("principalContractor"), clientName: str("clientName"),
        targetDiversionPct: target == null ? null : Number(target), actions: str("actions"), nextReviewOn: str("nextReviewOn"),
        lines: lines.filter((l) => l.wasteType.trim()).map((l) => ({ ...l, wasteType: l.wasteType.trim(), ewcCode: l.ewcCode?.trim() || null })),
      }),
    }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (res?.ok) { setNote(status === "approved" ? "Saved. The plan is back in draft as a new version, so approve it again." : "Saved."); router.refresh(); }
    else setError(d?.message ?? "Could not save.");
  }

  async function approve() {
    setBusy(true); setError(null); setNote(null);
    const res = await fetch(`${base}/approve`, { method: "POST" }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (res?.ok) router.refresh();
    else setError(d?.details?.missing ? `Still missing: ${d.details.missing.join("; ")}` : (d?.message ?? "Could not approve."));
  }

  const dis = !canEdit;
  return (
    <form onSubmit={save} className="space-y-6 rounded-xl border border-gray-200 bg-white p-5 print:border-0 print:p-0">
      <FormSection title="Responsibilities" cols={3}>
        <FormField label="Person responsible for the plan" htmlFor="sp-person"><Input id="sp-person" name="responsiblePerson" defaultValue={plan.responsiblePerson ?? ""} maxLength={160} disabled={dis} /></FormField>
        <FormField label="Principal contractor" htmlFor="sp-pc"><Input id="sp-pc" name="principalContractor" defaultValue={plan.principalContractor ?? ""} maxLength={160} disabled={dis} /></FormField>
        <FormField label="Client" htmlFor="sp-client" optional><Input id="sp-client" name="clientName" defaultValue={plan.clientName ?? ""} maxLength={160} disabled={dis} /></FormField>
      </FormSection>

      <section aria-labelledby="sp-lines" className="space-y-2">
        <h3 id="sp-lines" className="text-sm font-semibold text-zinc-900">Waste expected</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead><tr className="text-left text-xs text-gray-500"><th className="pb-1 pr-2">Waste type</th><th className="pb-1 pr-2">EWC code</th><th className="pb-1 pr-2">Forecast (t)</th><th className="pb-1 pr-2">Planned route</th><th /></tr></thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td className="pr-2 pb-2"><Input aria-label={`Waste type ${i + 1}`} value={l.wasteType} onChange={(e) => setLine(i, { wasteType: e.target.value })} maxLength={100} disabled={dis} /></td>
                  <td className="pr-2 pb-2"><Input aria-label={`EWC code ${i + 1}`} value={l.ewcCode ?? ""} onChange={(e) => setLine(i, { ewcCode: e.target.value })} placeholder="17 09 04" maxLength={20} disabled={dis} /></td>
                  <td className="pr-2 pb-2"><Input aria-label={`Forecast tonnes ${i + 1}`} type="number" min={0} step="any" value={l.forecastTonnes} onChange={(e) => setLine(i, { forecastTonnes: Number(e.target.value) })} disabled={dis} /></td>
                  <td className="pr-2 pb-2">
                    <select aria-label={`Planned route ${i + 1}`} className={fieldClass} value={l.plannedRoute} onChange={(e) => setLine(i, { plannedRoute: e.target.value as PlanLine["plannedRoute"] })} disabled={dis}>
                      {PLAN_ROUTES.map((r) => <option key={r} value={r}>{ROUTE_LABEL[r]}</option>)}
                    </select>
                  </td>
                  <td className="pb-2 print:hidden">{!dis && lines.length > 1 && <button type="button" className="text-xs text-red-700 underline" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>Remove</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!dis && <button type="button" className="text-sm font-medium text-teal-700 underline underline-offset-2 print:hidden" onClick={() => setLines((ls) => [...ls, { wasteType: "", ewcCode: "", forecastTonnes: 0, plannedRoute: "recycle" }])}>Add a waste type</button>}
      </section>

      <FormSection title="Targets and actions" cols={2}>
        <FormField label="Target: share diverted from landfill (%)" htmlFor="sp-target"><Input id="sp-target" name="target" type="number" min={0} max={100} step="any" defaultValue={plan.targetDiversionPct ?? ""} disabled={dis} /></FormField>
        <FormField label="Next review of the plan" htmlFor="sp-review"><Input id="sp-review" name="nextReviewOn" type="date" defaultValue={plan.nextReviewOn ?? ""} disabled={dis} /></FormField>
        <FormField label="Actions to reduce waste and landfill" htmlFor="sp-actions" span={2} hint="For example segregation at source, take-back schemes, off-site manufacture, reuse of excavated material.">
          <textarea id="sp-actions" name="actions" rows={4} maxLength={4000} defaultValue={plan.actions ?? ""} disabled={dis} className={fieldClass} />
        </FormField>
      </FormSection>

      <div className="space-y-2 print:hidden">
        <FormError>{error}</FormError>
        {note && <p role="status" className="text-sm text-gray-600">{note}</p>}
        <FormActions start={<Button type="button" variant="ghost" onClick={() => window.print()}>Print or save as PDF</Button>}>
          {canEdit && <Button type="submit" variant="outline" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>}
          {canApprove && status !== "approved" && <Button type="button" disabled={busy} onClick={() => void approve()}>Approve plan</Button>}
        </FormActions>
      </div>
    </form>
  );
}
