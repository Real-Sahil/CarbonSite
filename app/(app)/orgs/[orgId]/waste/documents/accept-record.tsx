"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FormActions, FormError, FormField, FormSection, fieldClass } from "@/components/forms/form-kit";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DISPOSAL_ROUTES } from "@/lib/waste/routes";

export type RecordPrefill = {
  reference: string | null; issuer: string | null; projectId: string | null;
  carrierRegistration?: string; ewc?: string; tonnes?: number; date?: string; vehicle?: string;
};

/** Turns a transfer note into a waste record: prefilled from what the file said, confirmed by a person. */
export function AcceptAsRecord({ orgId, docId, prefill, facilities, periods }: { orgId: string; docId: string; prefill: RecordPrefill; facilities: { id: string; name: string }[]; periods: { id: string; label: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dupe, setDupe] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);

  async function submit(allowDuplicate = false) {
    if (!formRef.current) return;
    setBusy(true);
    setError(null);
    const f = new FormData(formRef.current);
    const s = (k: string) => String(f.get(k) ?? "").trim() || null;
    const route = String(f.get("disposalRoute"));
    const res = await fetch(`/api/orgs/${orgId}/waste/documents/${docId}/accept-record`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        facilityId: s("facilityId"), reportingPeriodId: s("reportingPeriodId"), projectId: prefill.projectId,
        wasteType: s("wasteType"), disposalRoute: route, hazardous: route === "hazardous_landfill" || f.get("hazardous") === "on",
        weightTonnes: Number(f.get("weightTonnes")), ewcCode: s("ewcCode"), carrierName: s("carrierName"), carrierRegistration: s("carrierRegistration"),
        transferNoteReference: s("transferNoteReference"), destination: s("destination"), vehicleRegistration: s("vehicleRegistration"),
        recordedAt: s("recordedAt"), allowDuplicate,
      }),
    }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (res?.ok) { setOpen(false); router.refresh(); return; }
    setDupe(d?.code === "POSSIBLE_DUPLICATE");
    setError(d?.message ?? "Could not record the load.");
  }

  if (!open) return <button type="button" className="font-medium text-teal-700 underline underline-offset-2" onClick={() => setOpen(true)}>Record this load</button>;
  return (
    <form ref={formRef} onSubmit={(e) => { e.preventDefault(); void submit(); }} className="mt-2 w-[min(640px,90vw)] rounded-lg border border-gray-200 bg-white p-3 text-left">
      <FormSection title="Record this load as waste" cols={2}>
        <FormField label="Facility" htmlFor={`ar-fac-${docId}`}>
          <select id={`ar-fac-${docId}`} name="facilityId" required defaultValue={facilities[0]?.id ?? ""} className={fieldClass}>{facilities.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        </FormField>
        <FormField label="Reporting period" htmlFor={`ar-per-${docId}`}>
          <select id={`ar-per-${docId}`} name="reportingPeriodId" required defaultValue={periods[0]?.id ?? ""} className={fieldClass}>{periods.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
        </FormField>
        <FormField label="Waste type" htmlFor={`ar-type-${docId}`}><Input id={`ar-type-${docId}`} name="wasteType" required maxLength={100} placeholder="Mixed C&D" /></FormField>
        <FormField label="Where it went" htmlFor={`ar-route-${docId}`}>
          <select id={`ar-route-${docId}`} name="disposalRoute" required defaultValue="" className={fieldClass}><option value="" disabled>Choose</option>{DISPOSAL_ROUTES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
        </FormField>
        <FormField label="Weight (tonnes)" htmlFor={`ar-w-${docId}`}><Input id={`ar-w-${docId}`} name="weightTonnes" type="number" min={0} step="any" required defaultValue={prefill.tonnes ?? ""} /></FormField>
        <FormField label="Date" htmlFor={`ar-date-${docId}`}><Input id={`ar-date-${docId}`} name="recordedAt" type="date" required defaultValue={prefill.date ?? ""} /></FormField>
        <FormField label="EWC code" htmlFor={`ar-ewc-${docId}`} optional><Input id={`ar-ewc-${docId}`} name="ewcCode" maxLength={20} defaultValue={prefill.ewc ?? ""} /></FormField>
        <FormField label="Transfer note reference" htmlFor={`ar-ref-${docId}`} optional><Input id={`ar-ref-${docId}`} name="transferNoteReference" maxLength={100} defaultValue={prefill.reference ?? ""} /></FormField>
        <FormField label="Carrier" htmlFor={`ar-car-${docId}`} optional><Input id={`ar-car-${docId}`} name="carrierName" maxLength={200} defaultValue={prefill.issuer ?? ""} /></FormField>
        <FormField label="Carrier registration" htmlFor={`ar-reg-${docId}`} optional><Input id={`ar-reg-${docId}`} name="carrierRegistration" maxLength={40} defaultValue={prefill.carrierRegistration ?? ""} /></FormField>
        <FormField label="Destination" htmlFor={`ar-dest-${docId}`} optional><Input id={`ar-dest-${docId}`} name="destination" maxLength={200} /></FormField>
        <FormField label="Vehicle" htmlFor={`ar-veh-${docId}`} optional><Input id={`ar-veh-${docId}`} name="vehicleRegistration" maxLength={20} defaultValue={prefill.vehicle ?? ""} /></FormField>
        <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2"><input type="checkbox" name="hazardous" className="h-4 w-4 rounded border-gray-300" /> Hazardous waste</label>
      </FormSection>
      <div className="mt-3 space-y-2">
        <FormError>{error}</FormError>
        <FormActions start={<Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>}>
          {dupe && <Button type="button" variant="outline" disabled={busy} onClick={() => void submit(true)}>Record anyway</Button>}
          <Button type="submit" disabled={busy}>{busy ? "Recording…" : "Record load"}</Button>
        </FormActions>
      </div>
    </form>
  );
}
