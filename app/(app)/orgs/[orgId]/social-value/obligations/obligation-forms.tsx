"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const KINDS: [string, string][] = [
  ["employment_skills", "Employment and skills"],
  ["local_procurement", "Local procurement"],
  ["financial", "Financial contribution"],
  ["community", "Community"],
  ["other", "Other"],
];

const SELECT = "h-9 rounded-md border border-input bg-background px-2 text-sm";

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

  const field = (id: string, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`ob-${id}`}>{label}</Label>
      <Input id={`ob-${id}`} name={id} {...props} />
    </div>
  );

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
      {field("title", "What must be delivered", { required: true, maxLength: 200 })}
      {field("reference", "Planning reference", { maxLength: 100 })}
      {field("authority", "Local authority", { maxLength: 200 })}
      {field("clause", "Clause", { maxLength: 200, placeholder: "Schedule 4, para 2" })}
      <div className="grid gap-1.5">
        <Label htmlFor="ob-kind">Type</Label>
        <select id="ob-kind" name="kind" defaultValue="other" className={SELECT}>
          {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ob-siteId">Site</Label>
        <select id="ob-siteId" name="siteId" defaultValue="" className={SELECT}>
          <option value="">Not site-specific</option>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      {field("targetValue", "Target", { type: "number", min: 0, step: "any" })}
      {field("targetUnit", "Unit", { maxLength: 50, placeholder: "apprentices, £, hours" })}
      {field("dueDate", "Due", { type: "date" })}
      <div className="sm:col-span-3">
        <Button type="submit" disabled={busy}>{busy ? "Saving" : "Add obligation"}</Button>
        {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      </div>
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
