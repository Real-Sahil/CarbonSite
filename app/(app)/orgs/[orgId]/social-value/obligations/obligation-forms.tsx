"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormActions, FormError, FormField, FormSection } from "@/components/forms/form-kit";

const KINDS: [string, string][] = [
  ["employment_skills", "Employment and skills"],
  ["local_procurement", "Local procurement"],
  ["financial", "Financial contribution"],
  ["community", "Community"],
  ["other", "Other"],
];

const SELECT = "h-9 w-full rounded-[8px] border border-[#E5E7EB] bg-white px-3 text-sm hover:border-[#D1D5DB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50";

export function ObligationForm({ orgId, sites }: { orgId: string; sites: { id: string; name: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const text = (k: string) => (String(f.get(k) ?? "").trim() || null);
    const target = text("targetValue");
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/orgs/${orgId}/sv/obligations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: text("title"),
        reference: text("reference"),
        authority: text("authority"),
        clause: text("clause"),
        kind: f.get("kind"),
        siteId: text("siteId"),
        targetValue: target === null ? null : Number(target),
        targetUnit: text("targetUnit"),
        dueDate: text("dueDate"),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => null))?.message ?? "Could not save the obligation.");
      return;
    }
    form.reset();
    router.refresh();
  }

  const text = (id: string, label: string, props: React.ComponentProps<typeof Input> = {}, opts: { span?: 1 | 2 | 3 | 4; optional?: boolean; hint?: string } = {}) => (
    <FormField label={label} htmlFor={`ob-${id}`} span={opts.span} optional={opts.optional} hint={opts.hint}>
      <Input id={`ob-${id}`} name={id} {...props} />
    </FormField>
  );

  return (
    <form onSubmit={submit} className="space-y-6">
      <FormSection title="The obligation" description="What the agreement or planning condition requires of the site.">
        {text("title", "What must be delivered", { required: true, maxLength: 200 }, { span: 2 })}
        <FormField label="Type" htmlFor="ob-kind">
          <select id="ob-kind" name="kind" defaultValue="other" className={SELECT}>
            {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </FormField>
        <FormField label="Site" htmlFor="ob-siteId" optional>
          <select id="ob-siteId" name="siteId" defaultValue="" className={SELECT}>
            <option value="">Not site-specific</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </FormField>
      </FormSection>

      <FormSection title="Where it comes from">
        {text("reference", "Planning reference", { maxLength: 100 }, { optional: true })}
        {text("authority", "Local authority", { maxLength: 200 }, { span: 2, optional: true })}
        {text("clause", "Clause", { maxLength: 200, placeholder: "Schedule 4, para 2" }, { optional: true })}
      </FormSection>

      <FormSection title="Target and date">
        {text("targetValue", "Target", { type: "number", min: 0, step: "any" }, { optional: true })}
        {text("targetUnit", "Unit", { maxLength: 50 }, { optional: true, hint: "Apprentices, £, hours" })}
        {text("dueDate", "Due", { type: "date" }, { optional: true })}
      </FormSection>

      <FormError>{error}</FormError>
      <FormActions>
        <Button type="submit" size="sm" disabled={busy}>{busy ? "Saving" : "Add obligation"}</Button>
      </FormActions>
    </form>
  );
}

export function ObligationActions({ orgId, id, status, title }: { orgId: string; id: string; status: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function call(init: RequestInit) {
    setBusy(true);
    await fetch(`/api/orgs/${orgId}/sv/obligations/${id}`, init);
    setBusy(false);
    router.refresh();
  }
  const set = (next: string) =>
    call({ method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: next }) });
  return (
    <div className="flex gap-1">
      {status === "open" ? (
        <>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => set("met")} aria-label={`Mark ${title} as met`}>Met</Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => set("waived")} aria-label={`Mark ${title} as waived`}>Waived</Button>
        </>
      ) : (
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => set("open")} aria-label={`Reopen ${title}`}>Reopen</Button>
      )}
      <Button variant="ghost" size="sm" disabled={busy} onClick={() => call({ method: "DELETE" })} aria-label={`Remove ${title}`}>Remove</Button>
    </div>
  );
}
