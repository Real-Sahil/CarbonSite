"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2 } from "lucide-react";
import { FormActions, FormError, FormField, FormSection } from "@/components/forms/form-kit";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type LinkRow = {
  id: string; label: string; projectName: string | null; expiresAt: string; revokedAt: string | null; lastUsedAt: string | null; uploadCount: number;
};
type Project = { id: string; name: string };

/** Issue and withdraw the no-login upload links subcontractors use; their files land in the list above. */
export function SubmissionLinks({ orgId }: { orgId: string }) {
  const [allowed, setAllowed] = useState(false);
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [issued, setIssued] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/orgs/${orgId}/submission-links`).catch(() => null);
    if (!res?.ok) return;
    const d = await res.json();
    setLinks(d.links);
    setProjects(d.projects);
    setAllowed(true);
  }, [orgId]);
  useEffect(() => { void load(); }, [load]);
  if (!allowed) return null;

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    const res = await fetch(`/api/orgs/${orgId}/submission-links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: f.get("label"), projectId: f.get("projectId") || null, days: Number(f.get("days")) }),
    }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (res?.ok) {
      setIssued(d.url);
      void load();
    } else setError(d?.message ?? "Could not create the link.");
  }

  async function revoke(id: string) {
    await fetch(`/api/orgs/${orgId}/submission-links/${id}`, { method: "DELETE" });
    void load();
  }

  const live = links.filter((l) => !l.revokedAt && new Date(l.expiresAt) > new Date());

  return (
    <div className="rounded-lg bg-[#F9FAFB] px-4 py-3 text-sm text-[#374151]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link2 className="h-4 w-4 text-[#6B7280]" aria-hidden />
        <span>Subcontractors can send invoices and delivery notes through a link, no account needed. Their files appear in this list to match.</span>
        <button type="button" onClick={() => { setOpen(!open); setIssued(null); }} className="text-xs font-medium underline underline-offset-2">
          {open ? "Close" : `Upload links (${live.length})`}
        </button>
      </div>
      {open && (
        <div className="mt-3 flex flex-col gap-4">
          {issued ? (
            <div role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
              <p className="font-medium">Copy this link now. It is not shown again.</p>
              <p className="mt-1 break-all select-all font-mono text-xs">{issued}</p>
              <button type="button" className="mt-2 text-xs underline underline-offset-2" onClick={() => void navigator.clipboard?.writeText(issued)}>Copy</button>
              <button type="button" className="ml-3 mt-2 text-xs underline underline-offset-2" onClick={() => setIssued(null)}>Make another</button>
            </div>
          ) : (
            <form onSubmit={create} className="flex flex-col gap-3">
              <FormSection cols={3}>
                <FormField label="Who is it for" htmlFor="sl-label" hint="For example Acme Haulage."><Input id="sl-label" name="label" required maxLength={120} /></FormField>
                <FormField label="Project" htmlFor="sl-project" optional>
                  <select id="sl-project" name="projectId" className="h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm">
                    <option value="">Any</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </FormField>
                <FormField label="Valid for (days)" htmlFor="sl-days"><Input id="sl-days" name="days" type="number" min={1} max={180} defaultValue={30} required /></FormField>
              </FormSection>
              <FormError>{error}</FormError>
              <FormActions><Button type="submit" disabled={busy}>Create link</Button></FormActions>
            </form>
          )}
          {links.length > 0 && (
            <ul className="divide-y divide-[#E5E7EB] text-xs">
              {links.map((l) => {
                const dead = !!l.revokedAt || new Date(l.expiresAt) <= new Date();
                return (
                  <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                    <span className="font-medium text-[#111827]">{l.label}</span>
                    {l.projectName && <span>{l.projectName}</span>}
                    <span>{l.uploadCount} {l.uploadCount === 1 ? "file" : "files"}</span>
                    <span>{l.revokedAt ? "Withdrawn" : dead ? "Expired" : `Until ${new Date(l.expiresAt).toLocaleDateString("en-GB")}`}</span>
                    {!dead && <button type="button" onClick={() => void revoke(l.id)} className="ml-auto text-red-700 underline underline-offset-2">Withdraw</button>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
