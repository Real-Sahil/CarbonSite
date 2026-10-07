"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormActions, FormError, FormField, FormSection } from "@/components/forms/form-kit";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DOC_KINDS } from "@/lib/waste/documents";

export function AddDocument({ orgId, projects, defaultProjectId }: { orgId: string; projects: { id: string; name: string }[]; defaultProjectId: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/orgs/${orgId}/waste/documents`, { method: "POST", body: new FormData(e.currentTarget) }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (res?.ok) {
      setOpen(false);
      router.refresh();
    } else setError(d?.message ?? "Could not add the document.");
  }

  if (!open) return <Button onClick={() => setOpen(true)}>Add document</Button>;
  return (
    <form onSubmit={submit} className="w-full max-w-xl rounded-xl border border-gray-200 bg-white p-5">
      <FormSection title="Add a document" cols={2}>
        <FormField label="Kind" htmlFor="wd-kind">
          <select id="wd-kind" name="kind" required defaultValue="" className="h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm">
            <option value="" disabled>Choose</option>
            {DOC_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </FormField>
        <FormField label="Title" htmlFor="wd-title" optional hint="Defaults to the file name."><Input id="wd-title" name="title" maxLength={160} /></FormField>
        <FormField label="Reference" htmlFor="wd-ref" optional><Input id="wd-ref" name="reference" maxLength={120} /></FormField>
        <FormField label="Carrier or site it covers" htmlFor="wd-issuer" optional><Input id="wd-issuer" name="issuer" maxLength={160} /></FormField>
        <FormField label="Valid until" htmlFor="wd-valid" optional hint="For licences, permits and exemptions."><Input id="wd-valid" name="validUntil" type="date" /></FormField>
        <FormField label="Project" htmlFor="wd-project" optional>
          <select id="wd-project" name="projectId" defaultValue={defaultProjectId ?? ""} className="h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm">
            <option value="">Not tied to a project</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </FormField>
        <FormField label="File (PDF or photo, 10 MB)" htmlFor="wd-file" span={2}><Input id="wd-file" name="file" type="file" required accept="application/pdf,image/jpeg,image/png,image/webp" /></FormField>
      </FormSection>
      <div className="mt-4 space-y-3">
        <FormError>{error}</FormError>
        <FormActions start={<Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>}>
          <Button type="submit" disabled={busy}>{busy ? "Adding…" : "Add"}</Button>
        </FormActions>
      </div>
    </form>
  );
}

export function DocumentActions({ orgId, id, status }: { orgId: string; id: string; status: string }) {
  const router = useRouter();
  async function call(method: "PATCH" | "DELETE", body?: unknown) {
    await fetch(`/api/orgs/${orgId}/waste/documents/${id}`, { method, ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
    router.refresh();
  }
  return (
    <div className="flex gap-3 text-xs">
      {status === "pending" && (
        <>
          <button type="button" className="font-medium text-teal-700 underline underline-offset-2" onClick={() => void call("PATCH", { status: "accepted" })}>Accept</button>
          <button type="button" className="text-gray-600 underline underline-offset-2" onClick={() => void call("PATCH", { status: "rejected" })}>Reject</button>
        </>
      )}
      <button type="button" className="text-red-700 underline underline-offset-2" onClick={() => { if (confirm("Remove this entry? The file stays in your evidence.")) void call("DELETE"); }}>Remove</button>
    </div>
  );
}
