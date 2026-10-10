"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, FormActions, FormError, FormSection } from "@/components/forms/form-kit";
import { AddressPicker } from "@/components/address/address-picker";
import type { AddressSuggestion } from "@/lib/geo/address";

export function CreateSiteForm({
  orgId,
  contractId,
  projectId,
}: {
  orgId: string;
  contractId: string;
  projectId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Choosing a search result fills the address fields and gives the site its own position for the map.
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<AddressSuggestion | null>(null);
  const [fields, setFields] = useState({ addressLine1: "", city: "", postcode: "", country: "GB" });

  function pick(s: AddressSuggestion) {
    setPicked(s);
    setSearch(s.label);
    setFields({ addressLine1: s.addressLine, city: s.city ?? "", postcode: s.postcode ?? "", country: s.country ?? "GB" });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    const body = {
      name: data.get("name") as string,
      siteCode: (data.get("siteCode") as string) || undefined,
      postcode: (data.get("postcode") as string) || undefined,
      addressLine1: (data.get("addressLine1") as string) || undefined,
      city: (data.get("city") as string) || undefined,
      country: (data.get("country") as string) || "GB",
      ...(picked ? { latitude: picked.latitude, longitude: picked.longitude } : {}),
    };
    startTransition(async () => {
      const res = await fetch(
        `/api/orgs/${orgId}/contracts/${contractId}/projects/${projectId}/sites`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.message ?? "Could not create site");
        return;
      }
      form.reset();
      setPicked(null);
      setSearch("");
      setFields({ addressLine1: "", city: "", postcode: "", country: "GB" });
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-[#E5E7EB] bg-white p-4 sm:p-5">
      <FormSection title="New site" cols={3}>
          <FormField label="Name" htmlFor="site-name">
            <Input id="site-name" name="name" required placeholder="Site name" />
          </FormField>
          <FormField label="Site code" htmlFor="site-code" optional>
            <Input id="site-code" name="siteCode" placeholder="SITE-001" />
          </FormField>
          <FormField label="Find the address" htmlFor="site-search" span={3} optional hint="Choosing a result fills the fields below and places the site on the dashboard map, even without a UK postcode.">
            <AddressPicker id="site-search" orgId={orgId} country={fields.country.length === 2 ? fields.country : null} value={search} onChange={(t) => { setSearch(t); setPicked(null); }} onSelect={pick} disabled={isPending} />
          </FormField>
          <FormField label="Postcode" htmlFor="site-postcode" optional>
            <Input id="site-postcode" name="postcode" placeholder="SW1A 1AA" value={fields.postcode} onChange={(e) => setFields({ ...fields, postcode: e.target.value })} />
          </FormField>
          <FormField label="Address line 1" htmlFor="site-address" span={2} optional>
            <Input id="site-address" name="addressLine1" placeholder="1 Example Street" value={fields.addressLine1} onChange={(e) => setFields({ ...fields, addressLine1: e.target.value })} />
          </FormField>
          <FormField label="City" htmlFor="site-city" optional>
            <Input id="site-city" name="city" placeholder="London" value={fields.city} onChange={(e) => setFields({ ...fields, city: e.target.value })} />
          </FormField>
          <FormField label="Country" htmlFor="site-country" optional>
            <Input id="site-country" name="country" placeholder="GB" maxLength={2} value={fields.country} onChange={(e) => setFields({ ...fields, country: e.target.value })} />
          </FormField>
        </FormSection>
      <FormError>{error}</FormError>
      <FormActions>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Creating…" : "Create site"}
        </Button>
      </FormActions>
    </form>
  );
}

export function DeleteSiteButton({
  orgId,
  contractId,
  projectId,
  siteId,
  name,
}: {
  orgId: string;
  contractId: string;
  projectId: string;
  siteId: string;
  name: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!window.confirm(`Delete site "${name}"? This cannot be undone.`)) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(
        `/api/orgs/${orgId}/contracts/${contractId}/projects/${projectId}/sites/${siteId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.message ?? "Could not delete site");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        size="icon"
        variant="outline"
        disabled={isPending}
        title="Delete site"
        onClick={handleDelete}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
