"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CompanyFinder, CompanyFlags } from "@/components/company/company-finder";
import { FormActions, FormError, FormField, FormSection, fieldClass } from "@/components/forms/form-kit";

export function SupplierForm({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [postcode, setPostcode] = useState("");
  const [found, setFound] = useState<{ number: string; sic: string[]; flags: { level: "red" | "amber"; text: string }[]; smeHint: string | null } | null>(null);

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
        postcode: data.get("postcode") || undefined,
        ...(found && { companyNumber: found.number }),
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
    setName("");
    setPostcode("");
    setFound(null);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <FormSection title="Add a supplier" description="Where a supplier is based decides whether its spend counts as local.">
        <FormField label="Supplier name" htmlFor="sv-supplier-name" span={2} hint="As it appears on your records">
          <Input id="sv-supplier-name" name="name" required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField label="Postcode" htmlFor="sv-supplier-postcode">
          <Input id="sv-supplier-postcode" name="postcode" required maxLength={10} value={postcode} onChange={(e) => setPostcode(e.target.value)} />
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
        <CompanyFinder base={`/api/orgs/${orgId}/companies`} getName={() => name} onPick={(p) => { setName(p.company.name); if (p.company.postcode) setPostcode(p.company.postcode); setFound({ number: p.company.number, sic: p.company.sicCodes, flags: p.flags, smeHint: p.smeHint }); }} />
      </FormSection>
      {found && (
        <p className="space-y-1 text-xs text-gray-600">
          <CompanyFlags flags={found.flags} />{found.flags.length > 0 && <br />}
          {found.smeHint && <>{found.smeHint}<br /></>}
          Companies House {found.number}. {found.sic.length ? `SIC codes: ${found.sic.join(", ")}. Pick the one that matches what you buy when you add the industry code to a spend record.` : "No SIC codes filed."} Contains public sector information licensed under the Open Government Licence v3.0.
        </p>
      )}
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

/** Reads the supplier's Companies House record again and refreshes its flags. */
export function CheckCompanyButton({ orgId, supplierId }: { orgId: string; supplierId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setNote(null);
          const res = await fetch(`/api/orgs/${orgId}/sv/local-spend/suppliers/${supplierId}/check`, { method: "POST" }).catch(() => null);
          const d = await res?.json().catch(() => null);
          setBusy(false);
          if (!res?.ok) { setNote(d?.message ?? "Check failed."); return; }
          router.refresh();
        }}
      >
        {busy ? "Checking" : "Check"}
      </Button>
      {note && <span role="status" className="text-xs text-red-700">{note}</span>}
    </>
  );
}

/** Matches a supplier named on records to its company: pick it and the place is saved under the name the records use. */
export function MatchSupplier({ orgId, name }: { orgId: string; name: string }) {
  const router = useRouter();
  const [note, setNote] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end">
      <CompanyFinder
        base={`/api/orgs/${orgId}/companies`}
        getName={() => name}
        label="Match"
        onPick={async (p) => {
          setNote(null);
          const res = await fetch(`/api/orgs/${orgId}/sv/local-spend/suppliers`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name, companyNumber: p.company.number, ...(p.company.postcode && { postcode: p.company.postcode }) }),
          });
          if (!res.ok) { setNote((await res.json().catch(() => null))?.message ?? "Could not save."); return; }
          router.refresh();
        }}
      />
      {note && <span role="alert" className="text-xs text-red-700">{note}</span>}
    </span>
  );
}
