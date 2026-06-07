"use client";

import { FormEvent, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type SnapshotOption = {
  id: string;
  reportingPeriodId: string;
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

export function CreateReportForm({
  orgId,
  snapshots,
}: {
  orgId: string;
  snapshots: SnapshotOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const canCreate = snapshots.length > 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const snapshot = snapshots.find((item) => item.id === form.get("snapshotId"));

    startTransition(async () => {
      try {
        await postJson(`/api/orgs/${orgId}/reports`, {
          snapshotId: form.get("snapshotId"),
          reportingPeriodId: snapshot?.reportingPeriodId,
          type: form.get("type"),
        });
        event.currentTarget.reset();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not request report");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-lg border border-slate-200 p-4 lg:grid-cols-4">
      <Field label="Snapshot" className="lg:col-span-2">
        <select
          name="snapshotId"
          required
          disabled={!canCreate}
          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {snapshots.map((snapshot) => (
            <option key={snapshot.id} value={snapshot.id}>
              {snapshot.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Report type">
        <select
          name="type"
          disabled={!canCreate}
          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="inventory">Inventory</option>
          <option value="monthly_snapshot">Monthly snapshot</option>
          <option value="audit_package">Audit package</option>
        </select>
      </Field>
      <div className="flex items-end">
        <Button type="submit" disabled={!canCreate || isPending} className="w-full">
          <Plus className="h-4 w-4" />
          Request report
        </Button>
      </div>
      {!canCreate && (
        <p className="text-sm text-slate-500 lg:col-span-4">
          Publish a calculation snapshot before requesting a report.
        </p>
      )}
      {error && <p className="text-sm text-red-600 lg:col-span-4">{error}</p>}
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
