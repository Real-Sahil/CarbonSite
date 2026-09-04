"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Loader2, Plus } from "lucide-react";

export function CreateLegalEntityForm({
  orgId,
  entities,
}: {
  orgId: string;
  entities: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [country, setCountry] = useState("");
  const [parentId, setParentId] = useState("");
  const [ownershipPercent, setOwnershipPercent] = useState("100");
  const [operationalControl, setOperationalControl] = useState(true);
  const [financialControl, setFinancialControl] = useState(true);
  const [acquiredOn, setAcquiredOn] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) {
      setError("Give the entity a name.");
      return;
    }
    const pct = Number(ownershipPercent);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      setError("Ownership must be a percentage between 0 and 100.");
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/legal-entities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          ...(registrationNumber.trim() && { registrationNumber: registrationNumber.trim() }),
          ...(country.trim() && { country: country.trim() }),
          ...(parentId && { parentId }),
          ownershipPercent: pct,
          operationalControl,
          financialControl,
          ...(acquiredOn && { acquiredOn }),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? "Could not create the legal entity.");
        return;
      }
      setOpen(false);
      setName("");
      setRegistrationNumber("");
      setCountry("");
      setParentId("");
      setOwnershipPercent("100");
      setAcquiredOn("");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add entity
      </Button>
    );
  }

  return (
    <div className="w-full space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" htmlFor="le-name">
          <Input
            id="le-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Facilities Ltd"
          />
        </Field>
        <Field label="Company number" htmlFor="le-reg">
          <Input
            id="le-reg"
            value={registrationNumber}
            onChange={(e) => setRegistrationNumber(e.target.value)}
            placeholder="12345678"
          />
        </Field>
        <Field label="Country" htmlFor="le-country">
          <Input
            id="le-country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="United Kingdom"
          />
        </Field>
        <Field label="Parent entity" htmlFor="le-parent">
          <select
            id="le-parent"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <option value="">Top of group</option>
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Equity held by parent"
          htmlFor="le-pct"
          hint="Used under the equity share approach"
        >
          <Input
            id="le-pct"
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={ownershipPercent}
            onChange={(e) => setOwnershipPercent(e.target.value)}
          />
        </Field>
        <Field label="Acquired on" htmlFor="le-acq" hint="Emissions before this date are excluded">
          <Input
            id="le-acq"
            type="date"
            value={acquiredOn}
            onChange={(e) => setAcquiredOn(e.target.value)}
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={operationalControl}
            onChange={(e) => setOperationalControl(e.target.checked)}
            className="h-4 w-4 accent-zinc-900"
          />
          Group holds operational control
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={financialControl}
            onChange={(e) => setFinancialControl(e.target.checked)}
            className="h-4 w-4 accent-zinc-900"
          />
          Group holds financial control
        </label>
      </div>

      {error && (
        <p className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {saving ? "Saving" : "Add entity"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          disabled={saving}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-zinc-700">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}
