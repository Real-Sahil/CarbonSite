"use client";

import { FormEvent, useState, useTransition } from "react";
import type { ReactNode, SelectHTMLAttributes } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Option = {
  id: string;
  label: string;
};

type CategoryOption = Option & {
  scope: number;
};

async function postJson(url: string, payload: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? "Request failed");
  }
}

export function CreateRecordForm({
  orgId,
  periods,
  categories,
  facilities,
  businessUnits,
}: {
  orgId: string;
  periods: Option[];
  categories: CategoryOption[];
  facilities: Option[];
  businessUnits: Option[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const canCreate = periods.length > 0 && categories.length > 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        await postJson(`/api/orgs/${orgId}/records`, {
          reportingPeriodId: form.get("reportingPeriodId"),
          emissionCategoryId: form.get("emissionCategoryId"),
          activityDate: form.get("activityDate"),
          sourceDescription: form.get("sourceDescription"),
          amount: form.get("amount"),
          unit: form.get("unit"),
          supplierName: form.get("supplierName"),
          facilityId: form.get("facilityId"),
          businessUnitId: form.get("businessUnitId"),
          country: form.get("country"),
          pickupPostcode: form.get("pickupPostcode"),
          deliveryPostcode: form.get("deliveryPostcode"),
          distanceAmount: form.get("distanceAmount"),
          distanceUnit: form.get("distanceUnit"),
          distanceOverrideReason: form.get("distanceOverrideReason"),
          transportMode: form.get("transportMode"),
          fuelType: form.get("fuelType"),
          reviewStatus: form.get("reviewStatus"),
          evidenceStatus: form.get("evidenceStatus"),
          assumptionNotes: form.get("assumptionNotes"),
        });
        event.currentTarget.reset();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create record");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-lg border border-slate-200 p-4 xl:grid-cols-6">
      <Field label="Source" className="xl:col-span-2">
        <Input name="sourceDescription" maxLength={240} required disabled={!canCreate} />
      </Field>
      <Field label="Period">
        <Select name="reportingPeriodId" required disabled={!canCreate}>
          {periods.map((period) => (
            <option key={period.id} value={period.id}>
              {period.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Category" className="xl:col-span-2">
        <Select name="emissionCategoryId" required disabled={!canCreate}>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              Scope {category.scope}: {category.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Date">
        <Input name="activityDate" type="date" disabled={!canCreate} />
      </Field>
      <Field label="Amount">
        <Input name="amount" type="number" min="0.000001" step="0.000001" required disabled={!canCreate} />
      </Field>
      <Field label="Unit">
        <Input name="unit" maxLength={32} required disabled={!canCreate} />
      </Field>
      <Field label="Supplier">
        <Input name="supplierName" maxLength={160} disabled={!canCreate} />
      </Field>
      <Field label="Facility">
        <Select name="facilityId" disabled={!canCreate}>
          <option value="">Not assigned</option>
          {facilities.map((facility) => (
            <option key={facility.id} value={facility.id}>
              {facility.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Business unit">
        <Select name="businessUnitId" disabled={!canCreate}>
          <option value="">Not assigned</option>
          {businessUnits.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Country">
        <Input name="country" maxLength={80} disabled={!canCreate} />
      </Field>
      <Field label="Transport mode">
        <Input name="transportMode" maxLength={80} disabled={!canCreate} />
      </Field>
      <Field label="Fuel type">
        <Input name="fuelType" maxLength={80} disabled={!canCreate} />
      </Field>
      <Field label="Pickup postcode">
        <Input name="pickupPostcode" maxLength={12} disabled={!canCreate} />
      </Field>
      <Field label="Delivery postcode">
        <Input name="deliveryPostcode" maxLength={12} disabled={!canCreate} />
      </Field>
      <Field label="Manual distance">
        <Input name="distanceAmount" type="number" min="0" step="0.0001" disabled={!canCreate} />
      </Field>
      <Field label="Distance unit">
        <Select name="distanceUnit" disabled={!canCreate}>
          <option value="">Use route result</option>
          <option value="km">km</option>
          <option value="mile">mile</option>
        </Select>
      </Field>
      <Field label="Review">
        <Select name="reviewStatus" disabled={!canCreate}>
          <option value="draft">Draft</option>
          <option value="in_review">In review</option>
          <option value="approved">Approved</option>
        </Select>
      </Field>
      <Field label="Evidence">
        <Select name="evidenceStatus" disabled={!canCreate}>
          <option value="missing">Missing</option>
          <option value="partial">Partial</option>
          <option value="complete">Complete</option>
        </Select>
      </Field>
      <Field label="Assumptions" className="xl:col-span-5">
        <Input name="assumptionNotes" maxLength={2000} disabled={!canCreate} />
      </Field>
      <Field label="Distance override reason" className="xl:col-span-5">
        <Input name="distanceOverrideReason" maxLength={500} disabled={!canCreate} />
      </Field>
      <div className="flex items-end">
        <Button type="submit" disabled={!canCreate || isPending} className="w-full">
          <Plus className="h-4 w-4" />
          Add record
        </Button>
      </div>
      {!canCreate && (
        <p className="text-sm text-slate-500 xl:col-span-6">
          Create a reporting period and seed emission categories before entering activity records.
        </p>
      )}
      {error && <p className="text-sm text-red-600 xl:col-span-6">{error}</p>}
    </form>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs font-medium text-slate-600">{label}</Label>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function Select({
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </select>
  );
}
