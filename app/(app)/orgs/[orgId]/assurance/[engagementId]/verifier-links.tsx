"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormActions, FormError, FormField, FormSection } from "@/components/forms/form-kit";

interface LinkRow {
  id: string;
  snapshotId: string;
  name: string;
  company: string | null;
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
}

const day = (iso: string) => iso.slice(0, 10);

/** Issue and withdraw read-only verifier links to this engagement's snapshot, for people with no seat. */
export function VerifierLinks({ orgId, engagementId, snapshotId }: { orgId: string; engagementId: string; snapshotId: string }) {
  const [rows, setRows] = useState<LinkRow[]>([]);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [days, setDays] = useState("30");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/orgs/${orgId}/assurance/auditor-links`);
    if (res.ok) setRows(((await res.json()) as { data: LinkRow[] }).data.filter((r) => r.snapshotId === snapshotId));
  }, [orgId, snapshotId]);
  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFresh(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/assurance/auditor-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId, engagementId, name, company: company || undefined, days: Number(days) }),
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string; message?: string };
      if (!res.ok || !body.url) {
        setError(body.message ?? "Could not create the link.");
        return;
      }
      setFresh(body.url);
      setName("");
      setCompany("");
      await load();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    const res = await fetch(`/api/orgs/${orgId}/assurance/auditor-links/${id}`, { method: "DELETE" });
    if (res.ok) await load();
    else setError("Could not withdraw the link.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Verifier link</CardTitle>
        <p className="text-sm text-zinc-500">
          Gives an independent verifier read-only access to this snapshot&apos;s assurance pack for a limited time, with no seat in your organisation. Every visit and download is recorded in your audit log.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={create} className="space-y-4">
          <FormSection title="New link" cols={3}>
            <FormField label="Verifier's name" htmlFor="vl-name">
              <Input id="vl-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
            </FormField>
            <FormField label="Firm" htmlFor="vl-company" optional>
              <Input id="vl-company" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={200} />
            </FormField>
            <FormField label="Open for (days)" htmlFor="vl-days" hint="1 to 90">
              <Input id="vl-days" type="number" min={1} max={90} value={days} onChange={(e) => setDays(e.target.value)} required />
            </FormField>
          </FormSection>
          <FormError>{error}</FormError>
          <FormActions>
            <Button type="submit" size="sm" disabled={busy || !name.trim()}>
              Create link
            </Button>
          </FormActions>
        </form>

        {fresh && (
          <div role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <p className="font-medium">Copy this link now. It is shown once and cannot be recovered.</p>
            <p className="mt-1 break-all font-mono text-xs">{fresh}</p>
          </div>
        )}

        {rows.length > 0 && (
          <ul className="divide-y divide-zinc-100 text-sm">
            {rows.map((r) => {
              const expired = new Date(r.expiresAt) <= new Date();
              const state = r.revokedAt ? "Withdrawn" : expired ? "Expired" : `Open until ${day(r.expiresAt)}`;
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <span className="font-medium text-zinc-900">{r.name}</span>
                    {r.company ? `, ${r.company}` : ""} · {state}
                    {r.lastUsedAt ? ` · last opened ${day(r.lastUsedAt)}` : " · not opened yet"}
                  </span>
                  {!r.revokedAt && !expired && (
                    <Button type="button" size="sm" variant="outline" onClick={() => revoke(r.id)}>
                      Withdraw
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
