"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/forms/form-kit";

type Framework = { slug: string; name: string };
type LinkRow = { id: string; name: string; email: string | null; company: string | null; frameworks: string[]; expiresAt: string; revokedAt: string | null; lastUsedAt: string | null; createdAt: string };

export function CertificationWorkspace({ orgId, frameworks, canEdit, canPack, links }: { orgId: string; frameworks: Framework[]; canEdit: boolean; canPack: boolean; links: LinkRow[] }) {
  const router = useRouter();
  const [packFor, setPackFor] = useState<string[]>(frameworks.map((f) => f.slug));
  const [form, setForm] = useState({ name: "", email: "", company: "", days: "30", frameworks: frameworks.map((f) => f.slug) });
  const [created, setCreated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const nameOf = (slug: string) => frameworks.find((f) => f.slug === slug)?.name ?? slug;
  const toggle = (list: string[], slug: string) => (list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug]);

  function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreated(null);
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/management-systems/auditor-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim(), email: form.email.trim() || undefined, company: form.company.trim() || undefined, frameworks: form.frameworks, days: Number(form.days) }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) return setError(json?.message ?? "Could not create the link.");
      setCreated(json.url);
      setForm((f) => ({ ...f, name: "", email: "", company: "" }));
      router.refresh();
    });
  }

  function revoke(id: string) {
    if (!window.confirm("Withdraw this link? The auditor loses access at once.")) return;
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/management-systems/auditor-access/${id}`, { method: "DELETE" });
      if (!res.ok) return setError("Could not withdraw the link.");
      router.refresh();
    });
  }

  const now = new Date().toISOString();
  return (
    <div className="flex flex-col gap-6">
      {canPack && (
        <section className="flex flex-col gap-3 rounded-[14px] border border-[#E5E7EB] bg-white p-5">
          <h2 className="text-sm font-semibold text-[#111827]">Certification pack</h2>
          <div className="flex flex-wrap gap-x-4 gap-y-2" role="group" aria-label="Frameworks in the pack">
            {frameworks.map((f) => (
              <label key={f.slug} className="flex items-center gap-1.5 text-sm text-[#374151]">
                <input type="checkbox" checked={packFor.includes(f.slug)} onChange={() => setPackFor(toggle(packFor, f.slug))} className="h-4 w-4" />
                {f.name}
              </label>
            ))}
          </div>
          <a
            href={`/api/orgs/${orgId}/management-systems/certification-pack?frameworks=${encodeURIComponent(packFor.join(","))}`}
            aria-disabled={!packFor.length}
            className={`self-start rounded-lg px-4 py-2 text-sm font-medium text-white ${packFor.length ? "bg-[#c2410c] hover:bg-[#9a3412]" : "pointer-events-none bg-[#D1D5DB]"}`}
          >
            Download ZIP
          </a>
        </section>
      )}

      {canEdit && (
        <section className="flex flex-col gap-4 rounded-[14px] border border-[#E5E7EB] bg-white p-5">
          <h2 className="text-sm font-semibold text-[#111827]">Auditor links</h2>
          <form onSubmit={create} className="grid gap-4 sm:grid-cols-2">
            <FormField label="Auditor&apos;s name (required)" htmlFor="aa-name">
              <Input id="aa-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="h-9" />
            </FormField>
            <FormField label="Certification body" htmlFor="aa-company" optional>
              <Input id="aa-company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="h-9" />
            </FormField>
            <FormField label="Email" htmlFor="aa-email" optional>
              <Input id="aa-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-9" />
            </FormField>
            <FormField label="Days the link works" htmlFor="aa-days" optional>
              <Input id="aa-days" type="number" min={1} max={90} value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} className="h-9" />
            </FormField>
            <div className="flex flex-wrap gap-x-4 gap-y-2 sm:col-span-2" role="group" aria-label="Frameworks shared">
              {frameworks.map((f) => (
                <label key={f.slug} className="flex items-center gap-1.5 text-sm text-[#374151]">
                  <input type="checkbox" checked={form.frameworks.includes(f.slug)} onChange={() => setForm({ ...form, frameworks: toggle(form.frameworks, f.slug) })} className="h-4 w-4" />
                  {f.name}
                </label>
              ))}
            </div>
            <Button type="submit" size="sm" disabled={isPending || !form.frameworks.length} className="self-start">{isPending ? "Creating…" : "Create link"}</Button>
          </form>
          {created && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-sm">
              <p className="font-medium text-[#111827]">Copy this link now; it is not shown again.</p>
              <p className="mt-1 break-all font-mono text-xs">{created}</p>
              <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => navigator.clipboard?.writeText(created)}>Copy</Button>
            </div>
          )}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          {links.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#E5E7EB] text-xs text-[#6B7280]">
                  <tr><th className="py-2 pr-4">Auditor</th><th className="py-2 pr-4">Frameworks</th><th className="py-2 pr-4">Expires</th><th className="py-2 pr-4">Last used</th><th className="py-2" /></tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {links.map((l) => {
                    const live = !l.revokedAt && l.expiresAt > now;
                    return (
                      <tr key={l.id}>
                        <td className="py-2 pr-4">{l.name}{l.company ? <span className="block text-xs text-[#6B7280]">{l.company}</span> : null}</td>
                        <td className="py-2 pr-4 text-[#374151]">{l.frameworks.map(nameOf).join(", ")}</td>
                        <td className="whitespace-nowrap py-2 pr-4 tabular-nums">{l.revokedAt ? "Withdrawn" : l.expiresAt.slice(0, 10)}</td>
                        <td className="whitespace-nowrap py-2 pr-4 tabular-nums text-[#6B7280]">{l.lastUsedAt?.slice(0, 10) ?? "Not yet"}</td>
                        <td className="py-2 text-right">{live && <Button size="sm" variant="outline" onClick={() => revoke(l.id)} disabled={isPending}>Withdraw</Button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
