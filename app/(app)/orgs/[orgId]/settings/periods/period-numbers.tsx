"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormError, FormField } from "@/components/forms/form-kit";

/** Revenue and staff numbers for a period: they feed intensity figures and the waste KPIs (tonnes per 100k). */
export function PeriodNumbers({ orgId, periodId, revenue, currency, fte, locked }: { orgId: string; periodId: string; revenue: number | null; currency: string; fte: number | null; locked: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    const num = (k: string) => (f.get(k) ? Number(f.get(k)) : null);
    const res = await fetch(`/api/orgs/${orgId}/reporting-periods/${periodId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revenueAmount: num("revenue"), revenueCurrency: currency, fteCount: num("fte") }),
    }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (res?.ok) { setOpen(false); router.refresh(); } else setError(d?.message ?? "Could not save.");
  }

  const summary = [revenue != null ? `Revenue ${revenue.toLocaleString("en-GB")} ${currency}` : null, fte != null ? `${fte} staff` : null].filter(Boolean).join(" · ");
  return (
    <div className="mt-1 text-xs text-muted-foreground">
      {summary || "No revenue or staff numbers yet."}{" "}
      {!locked && <button type="button" className="underline underline-offset-2" onClick={() => setOpen(!open)}>{open ? "Close" : "Edit"}</button>}
      {open && (
        <form onSubmit={save} className="mt-2 grid max-w-md gap-3 sm:grid-cols-2">
          <FormField label={`Revenue (${currency})`} htmlFor={`rev-${periodId}`} optional><Input id={`rev-${periodId}`} name="revenue" type="number" min={0} step="any" defaultValue={revenue ?? ""} /></FormField>
          <FormField label="Staff (FTE)" htmlFor={`fte-${periodId}`} optional><Input id={`fte-${periodId}`} name="fte" type="number" min={0} step="any" defaultValue={fte ?? ""} /></FormField>
          <div className="sm:col-span-2 space-y-2"><FormError>{error}</FormError><Button type="submit" size="sm" disabled={busy}>{busy ? "Saving…" : "Save"}</Button></div>
        </form>
      )}
    </div>
  );
}
