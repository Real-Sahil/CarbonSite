"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormActions, FormError, FormField, FormSection, fieldClass } from "@/components/forms/form-kit";

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
    <form onSubmit={submit} className="space-y-4">
      <FormSection title="Add a supplier" description="Where a supplier is based decides whether its spend counts as local.">
        <FormField label="Supplier name" htmlFor="sv-supplier-name" span={2} hint="As it appears on your records">
          <Input id="sv-supplier-name" name="name" required maxLength={200} />
        </FormField>
        <FormField label="Postcode" htmlFor="sv-supplier-postcode">
          <Input id="sv-supplier-postcode" name="postcode" required maxLength={10} />
        </FormField>
        <FormField label="SME" htmlFor="sv-supplier-sme">
          <select
            id="sv-supplier-sme"
            name="sme"
            defaultValue="unknown"
            className={fieldClass}
          >
            <option value="unknown">Not known</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </FormField>
      </FormSection>
      <FormError>{error}</FormError>
      <FormActions>
        <Button type="submit" size="sm" disabled={busy}>{busy ? "Saving" : "Save supplier"}</Button>
      </FormActions>
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
