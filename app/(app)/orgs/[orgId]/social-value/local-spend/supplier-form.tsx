"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SupplierForm({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError(null);
    const sme = data.get("sme");
    const res = await fetch(`/api/orgs/${orgId}/sv/local-spend/suppliers`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: data.get("name"),
        postcode: data.get("postcode"),
        sme: sme === "yes" ? true : sme === "no" ? false : null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.message ?? "Could not save the supplier.");
      return;
    }
    form.reset();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_9rem_9rem_auto] sm:items-end">
      <div className="grid gap-1.5">
        <Label htmlFor="sv-supplier-name">Supplier name, as it appears on your records</Label>
        <Input id="sv-supplier-name" name="name" required maxLength={200} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="sv-supplier-postcode">Postcode</Label>
        <Input id="sv-supplier-postcode" name="postcode" required maxLength={10} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="sv-supplier-sme">SME</Label>
        <select
          id="sv-supplier-sme"
          name="sme"
          defaultValue="unknown"
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="unknown">Not known</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </div>
      <Button type="submit" disabled={busy}>{busy ? "Saving" : "Save supplier"}</Button>
      {error && <p role="alert" className="text-sm text-red-700 sm:col-span-4">{error}</p>}
    </form>
  );
}

export function RemoveSupplierButton({ orgId, supplierId, name }: { orgId: string; supplierId: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={busy}
      aria-label={`Remove ${name}`}
      onClick={async () => {
        setBusy(true);
        await fetch(`/api/orgs/${orgId}/sv/local-spend/suppliers/${supplierId}`, { method: "DELETE" });
        setBusy(false);
        router.refresh();
      }}
    >
      Remove
    </Button>
  );
}
