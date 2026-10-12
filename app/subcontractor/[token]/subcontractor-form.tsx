"use client";

import { useEffect, useState } from "react";
import { FormActions, FormError, FormField, FormSection } from "@/components/forms/form-kit";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export type PortalView = {
  orgName: string;
  subcontractorName: string;
  reportingPeriodLabel: string;
  dueDate: string;
  status: string;
  canSubmit: boolean;
  submittedAt: string | null;
  rejectionReason: string | null;
  linkExpiresAt: string | null;
};

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    : null;

export function SubcontractorForm({ token, view }: { token: string; view: PortalView }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // Records that the form opened. A failure here does not stop the form working.
  useEffect(() => {
    fetch(`/api/public/subcontractor/${token}/opened`, { method: "POST", keepalive: true }).catch(() => null);
  }, [token]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/public/subcontractor/${token}/submit`, {
      method: "POST",
      body: new FormData(e.currentTarget),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setBusy(false);
    if (res?.ok) {
      setSent(true);
      return;
    }
    setError(data?.message ?? "Sending failed. Check your connection and try again.");
  }

  if (sent) {
    return (
      <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
        <p className="font-medium">Thank you. Your figures went to {view.orgName}.</p>
        <p className="mt-1">They will check them. Nothing more is needed from you, and this link no longer takes changes.</p>
      </div>
    );
  }

  if (!view.canSubmit) {
    const message =
      view.status === "verified"
        ? `${view.orgName} has verified your figures. Nothing more is needed from you.`
        : `Your figures were sent to ${view.orgName}${fmtDate(view.submittedAt) ? ` on ${fmtDate(view.submittedAt)}` : ""} and are waiting to be checked. This link no longer takes changes.`;
    return (
      <p role="status" className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-700">
        {message}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 rounded-lg border border-slate-200 bg-white p-5">
      {view.status === "rejected" && view.rejectionReason && (
        <p role="alert" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {view.orgName} sent back your last figures: {view.rejectionReason} Send them again below.
        </p>
      )}
      <FormSection title="Who is sending" cols={2}>
        <FormField label="Your name" htmlFor="submitterName" hint="The person sending these figures.">
          <Input id="submitterName" name="submitterName" required maxLength={120} autoComplete="name" />
        </FormField>
      </FormSection>
      <FormSection title="Tonnes CO2e by scope" description="Enter at least one scope. Up to four decimal places." cols={2}>
        <FormField label="Scope 1" htmlFor="scope1Tco2e" optional hint="Fuel burned in your own vehicles, plant and generators.">
          <Input id="scope1Tco2e" name="scope1Tco2e" inputMode="decimal" placeholder="e.g. 12.5" />
        </FormField>
        <FormField label="Scope 2" htmlFor="scope2Tco2e" optional hint="Electricity, heat or steam you bought.">
          <Input id="scope2Tco2e" name="scope2Tco2e" inputMode="decimal" placeholder="e.g. 3.2" />
        </FormField>
        <FormField label="Scope 3" htmlFor="scope3Tco2e" optional hint="Other supply chain emissions for this work.">
          <Input id="scope3Tco2e" name="scope3Tco2e" inputMode="decimal" placeholder="e.g. 8.1" />
        </FormField>
      </FormSection>
      <FormSection title="Supporting detail" cols={2}>
        <FormField label="Calculation or invoice" htmlFor="evidence" optional span={2} hint="PDF or photo, up to 10 MB.">
          <Input id="evidence" name="evidence" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" />
        </FormField>
        <FormField label="Note" htmlFor="submitterNote" optional span={2} hint="How you worked the figures out, or anything the team should know.">
          <Textarea id="submitterNote" name="submitterNote" maxLength={1000} rows={3} />
        </FormField>
      </FormSection>
      <FormError>{error}</FormError>
      <FormActions>
        <Button type="submit" disabled={busy}>{busy ? "Sending…" : "Send figures"}</Button>
      </FormActions>
    </form>
  );
}
