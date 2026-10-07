"use client";

import { useState } from "react";
import { FormActions, FormError, FormField, FormSection } from "@/components/forms/form-kit";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function UploadForm({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ accepted: number; skipped: string[] } | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = e.currentTarget;
    const res = await fetch(`/api/public/submit/${token}`, { method: "POST", body: new FormData(form) }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setBusy(false);
    if (res?.ok) {
      setDone({ accepted: data.accepted, skipped: data.skipped ?? [] });
      form.reset();
    } else {
      const skipped: string[] = data?.skipped ?? [];
      setError([data?.message ?? "Upload failed. Try again.", ...skipped].join(" "));
    }
  }

  if (done) {
    return (
      <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
        <p className="font-medium">Thank you. {done.accepted} {done.accepted === 1 ? "file was" : "files were"} sent.</p>
        {done.skipped.length > 0 && <p className="mt-1">Not sent: {done.skipped.join("; ")}</p>}
        <button type="button" className="mt-3 underline underline-offset-2" onClick={() => setDone(null)}>Send more</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 rounded-lg border border-slate-200 bg-white p-5">
      <FormSection title="Who is sending" cols={2}>
        <FormField label="Your name" htmlFor="name"><Input id="name" name="name" required maxLength={120} autoComplete="name" /></FormField>
        <FormField label="Company" htmlFor="company" optional><Input id="company" name="company" maxLength={160} autoComplete="organization" /></FormField>
      </FormSection>
      <FormSection title="Documents" cols={2}>
        <FormField label="PDF or photo files" htmlFor="file" span={2} hint="Invoices, delivery notes, orders. Up to 5, 10 MB each.">
          <Input id="file" name="file" type="file" required multiple accept="application/pdf,image/jpeg,image/png,image/webp" />
        </FormField>
        <FormField label="Note" htmlFor="note" span={2} optional hint="For example the order number or what the document covers.">
          <Input id="note" name="note" maxLength={500} />
        </FormField>
      </FormSection>
      <FormError>{error}</FormError>
      <FormActions>
        <Button type="submit" disabled={busy}>{busy ? "Sending…" : "Send"}</Button>
      </FormActions>
    </form>
  );
}
