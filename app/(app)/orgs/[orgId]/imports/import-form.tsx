"use client";

import { FormEvent, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type PeriodOption = {
  id: string;
  label: string;
};

export function CreateImportForm({
  orgId,
  periods,
}: {
  orgId: string;
  periods: PeriodOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const canCreate = periods.length > 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/orgs/${orgId}/imports`, {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.message ?? "Import upload failed");
        }
        event.currentTarget.reset();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import upload failed");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-lg border border-slate-200 p-4 lg:grid-cols-4">
      <Field label="Reporting period">
        <select
          name="reportingPeriodId"
          required
          disabled={!canCreate}
          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {periods.map((period) => (
            <option key={period.id} value={period.id}>
              {period.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Template">
        <select
          name="templateKey"
          disabled={!canCreate}
          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="activity_csv">Activity CSV</option>
          <option value="construction_materials">Construction materials</option>
          <option value="waste_collections">Waste collections</option>
          <option value="haulage_trips">Haulage trips</option>
        </select>
      </Field>
      <Field label="Source file">
        <input
          name="file"
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          required
          disabled={!canCreate}
          className="h-9 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:cursor-not-allowed disabled:opacity-50"
        />
      </Field>
      <div className="flex items-end">
        <Button type="submit" disabled={!canCreate || isPending} className="w-full">
          <Upload className="h-4 w-4" />
          Upload import
        </Button>
      </div>
      {!canCreate && (
        <p className="text-sm text-slate-500 lg:col-span-4">
          Create a reporting period before uploading import data.
        </p>
      )}
      {error && <p className="text-sm text-red-600 lg:col-span-4">{error}</p>}
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs font-medium text-slate-600">{label}</Label>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}
