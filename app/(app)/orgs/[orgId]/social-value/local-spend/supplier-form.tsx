"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormActions, FormError, FormField, FormSection, fieldClass } from "@/components/forms/form-kit";

type Candidate = { number: string; name: string; status: string | null; address: string | null };

/** Finds a supplier on the Companies House register; the person picks the company, nothing is guessed. */
function CompanyFinder({ orgId, name, onPick }: { orgId: string; name: string; onPick: (c: { name: string; postcode: string | null; sic: string[]; number: string }) => void }) {
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState<Candidate[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  async function find() {
    setBusy(true);
    setNote(null);
    const res = await fetch(`/api/orgs/${orgId}/companies?q=${encodeURIComponent(name.trim())}`).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) { setNote(d?.message ?? "Company lookup failed."); setList(null); return; }
    setList(d.candidates);
    if (d.candidates.length === 0) setNote("No company found. Check the name, or type the postcode.");
  }
  async function pick(c: Candidate) {
    setBusy(true);
    const res = await fetch(`/api/orgs/${orgId}/companies?number=${c.number}`).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) { setNote(d?.message ?? "Could not read that company."); return; }
    setList(null);
    onPick({ name: d.company.name, postcode: d.company.postcode, sic: d.company.sicCodes, number: d.company.number });
  }
  return (
    <div className="sm:col-span-4">
      <Button type="button" variant="outline" size="sm" disabled={busy || name.trim().length < 3} onClick={() => void find()}>{busy ? "Looking…" : "Find on Companies House"}</Button>
      {note && <p role="status" className="mt-1 text-xs text-gray-600">{note}</p>}
      {list && list.length > 0 && (
        <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200 text-sm">
          {list.map((c) => (
            <li key={c.number}>
              <button type="button" className="w-full px-3 py-2 text-left hover:bg-gray-50" onClick={() => void pick(c)}>
                <span className="font-medium text-gray-900">{c.name}</span> <span className="text-xs text-gray-500">{c.number}{c.status && c.status !== "active" ? ` · ${c.status}` : ""}</span>
                {c.address && <span className="block text-xs text-gray-500">{c.address}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SupplierForm({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [postcode, setPostcode] = useState("");
  const [found, setFound] = useState<{ number: string; sic: string[] } | null>(null);

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
        <CompanyFinder orgId={orgId} name={name} onPick={(c) => { setName(c.name); if (c.postcode) setPostcode(c.postcode); setFound({ number: c.number, sic: c.sic }); }} />
      </FormSection>
      {found && (
        <p className="text-xs text-gray-600">
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
