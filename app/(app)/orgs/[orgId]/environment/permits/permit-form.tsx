"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Loader2, Plus } from "lucide-react";

const PERMIT_TYPES = [
  { value: "environmental_permit", label: "Environmental permit", noticeDays: 180 },
  { value: "discharge_consent", label: "Discharge consent", noticeDays: 120 },
  { value: "abstraction_licence", label: "Abstraction licence", noticeDays: 120 },
  { value: "waste_carrier_licence", label: "Waste carrier licence", noticeDays: 60 },
  { value: "waste_management_licence", label: "Waste management licence", noticeDays: 120 },
  { value: "air_emissions_permit", label: "Air emissions permit", noticeDays: 180 },
  { value: "radioactive_substances", label: "Radioactive substances", noticeDays: 180 },
  { value: "species_licence", label: "Species licence", noticeDays: 90 },
  { value: "planning_condition", label: "Planning condition", noticeDays: 90 },
  { value: "other", label: "Other", noticeDays: 90 },
] as const;

export function CreatePermitForm({
  orgId,
  facilities,
}: {
  orgId: string;
  facilities: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>("environmental_permit");
  const [reference, setReference] = useState("");
  const [title, setTitle] = useState("");
  const [issuingAuthority, setIssuingAuthority] = useState("");
  const [facilityId, setFacilityId] = useState("");
  const [issuedOn, setIssuedOn] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  // Renewal lead times differ hugely by regime, so the default follows the
  // permit type and the user can still override it.
  const [renewalNoticeDays, setRenewalNoticeDays] = useState("180");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onTypeChange(next: string) {
    setType(next);
    const match = PERMIT_TYPES.find((t) => t.value === next);
    if (match) setRenewalNoticeDays(String(match.noticeDays));
  }

  async function submit() {
    if (!reference.trim() || !title.trim() || !issuingAuthority.trim()) {
      setError("Reference, title and issuing authority are all required.");
      return;
    }
    const notice = Number(renewalNoticeDays);
    if (!Number.isInteger(notice) || notice < 0 || notice > 1095) {
      setError("Renewal notice must be a whole number of days between 0 and 1095.");
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/permits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          reference: reference.trim(),
          title: title.trim(),
          issuingAuthority: issuingAuthority.trim(),
          ...(facilityId && { facilityId }),
          ...(issuedOn && { issuedOn }),
          ...(expiresOn && { expiresOn }),
          renewalNoticeDays: notice,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? "Could not record the permit.");
        return;
      }
      setOpen(false);
      setReference("");
      setTitle("");
      setIssuingAuthority("");
      setFacilityId("");
      setIssuedOn("");
      setExpiresOn("");
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
        Add permit
      </Button>
    );
  }

  return (
    <div className="w-full space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Type" htmlFor="p-type">
          <select
            id="p-type"
            value={type}
            onChange={(e) => onTypeChange(e.target.value)}
            className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            {PERMIT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Reference" htmlFor="p-ref">
          <Input
            id="p-ref"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="EPR/AB1234CD"
          />
        </Field>

        <Field label="Issuing authority" htmlFor="p-auth">
          <Input
            id="p-auth"
            value={issuingAuthority}
            onChange={(e) => setIssuingAuthority(e.target.value)}
            placeholder="Environment Agency"
          />
        </Field>

        <Field label="Title" htmlFor="p-title">
          <Input
            id="p-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Waste transfer station permit"
          />
        </Field>

        <Field label="Facility" htmlFor="p-fac">
          <select
            id="p-fac"
            value={facilityId}
            onChange={(e) => setFacilityId(e.target.value)}
            className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <option value="">Organisation wide</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Issued on" htmlFor="p-issued">
          <Input
            id="p-issued"
            type="date"
            value={issuedOn}
            onChange={(e) => setIssuedOn(e.target.value)}
          />
        </Field>

        <Field label="Expires on" htmlFor="p-exp" hint="Leave blank if it does not expire">
          <Input
            id="p-exp"
            type="date"
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
          />
        </Field>

        <Field
          label="Renewal notice"
          htmlFor="p-notice"
          hint="Days before expiry to start renewing"
        >
          <Input
            id="p-notice"
            type="number"
            min={0}
            max={1095}
            value={renewalNoticeDays}
            onChange={(e) => setRenewalNoticeDays(e.target.value)}
          />
        </Field>
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
          {saving ? "Saving" : "Add permit"}
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
