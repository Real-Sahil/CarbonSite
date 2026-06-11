"use client";

import { FormEvent, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PeriodOption = {
  id: string;
  label: string;
};

type MemberOption = {
  userId: string;
  label: string;
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

export function CreateTargetForm({
  orgId,
  periods,
}: {
  orgId: string;
  periods: PeriodOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const canCreate = periods.length >= 2;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        await postJson(`/api/orgs/${orgId}/targets`, {
          baselinePeriodId: form.get("baselinePeriodId"),
          targetPeriodId: form.get("targetPeriodId"),
          targetType: form.get("targetType"),
          reductionAmount: form.get("reductionAmount"),
        });
        event.currentTarget.reset();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create target");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-lg border border-slate-200 p-4 lg:grid-cols-5">
      <Field label="Baseline">
        <select
          name="baselinePeriodId"
          required
          disabled={!canCreate}
          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm"
        >
          {periods.map((period) => (
            <option key={period.id} value={period.id}>
              {period.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Target period">
        <select
          name="targetPeriodId"
          required
          disabled={!canCreate}
          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm"
        >
          {periods.map((period) => (
            <option key={period.id} value={period.id}>
              {period.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Type">
        <select
          name="targetType"
          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm"
        >
          <option value="absolute">Absolute</option>
          <option value="intensity">Intensity</option>
        </select>
      </Field>
      <Field label="Reduction kgCO2e">
        <Input name="reductionAmount" type="number" min="0.0001" step="0.0001" required disabled={!canCreate} />
      </Field>
      <div className="flex items-end">
        <Button type="submit" disabled={!canCreate || isPending} className="w-full">
          <Plus className="h-4 w-4" />
          Add target
        </Button>
      </div>
      {!canCreate && (
        <p className="text-sm text-slate-500 lg:col-span-5">
          Create at least two reporting periods before adding a reduction target.
        </p>
      )}
      {error && <p className="text-sm text-red-600 lg:col-span-5">{error}</p>}
    </form>
  );
}

export function CreateInitiativeForm({
  orgId,
  members,
}: {
  orgId: string;
  members: MemberOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        await postJson(`/api/orgs/${orgId}/initiatives`, {
          name: form.get("name"),
          ownerUserId: form.get("ownerUserId"),
          status: form.get("status"),
          costAmount: form.get("costAmount"),
          costCurrency: form.get("costCurrency") || "GBP",
          expectedImpactCo2e: form.get("expectedImpactCo2e"),
          expectedStartDate: form.get("expectedStartDate"),
          notes: form.get("notes"),
        });
        event.currentTarget.reset();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create initiative");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-lg border border-slate-200 p-4 lg:grid-cols-6">
      <Field label="Initiative" className="lg:col-span-2">
        <Input name="name" minLength={2} maxLength={160} required />
      </Field>
      <Field label="Owner">
        <select name="ownerUserId" className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm">
          <option value="">Unassigned</option>
          {members.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Status">
        <select name="status" className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm">
          <option value="planned">Planned</option>
          <option value="in_progress">In progress</option>
          <option value="complete">Complete</option>
          <option value="canceled">Canceled</option>
        </select>
      </Field>
      <Field label="Impact kgCO2e">
        <Input name="expectedImpactCo2e" type="number" min="0" step="0.0001" />
      </Field>
      <Field label="Cost GBP">
        <Input name="costAmount" type="number" min="0" step="0.01" />
        <input type="hidden" name="costCurrency" value="GBP" />
      </Field>
      <Field label="Start date">
        <Input name="expectedStartDate" type="date" />
      </Field>
      <Field label="Notes" className="lg:col-span-5">
        <Input name="notes" maxLength={2000} />
      </Field>
      <div className="flex items-end">
        <Button type="submit" disabled={isPending} className="w-full">
          <Plus className="h-4 w-4" />
          Add initiative
        </Button>
      </div>
      {error && <p className="text-sm text-red-600 lg:col-span-6">{error}</p>}
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
