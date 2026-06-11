"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Calculator, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Option = {
  id: string;
  label: string;
};

type RunOption = Option & {
  status: string;
};

export function CalculationControls({
  orgId,
  periods,
  methodologies,
  factorLibraries,
  succeededRuns,
}: {
  orgId: string;
  periods: Option[];
  methodologies: Option[];
  factorLibraries: Option[];
  succeededRuns: RunOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const canRun = periods.length > 0 && methodologies.length > 0 && factorLibraries.length > 0;
  const canPublish = succeededRuns.length > 0;

  function handleCalculation(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/calculation-runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportingPeriodId: formData.get("reportingPeriodId"),
          methodologyVersionId: formData.get("methodologyVersionId"),
          factorLibraryId: formData.get("factorLibraryId"),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Could not start calculation run");
        return;
      }
      router.refresh();
    });
  }

  function handlePublish(formData: FormData) {
    setError(null);
    const runId = String(formData.get("runId") ?? "");
    startTransition(async () => {
      const res = await fetch(
        `/api/orgs/${orgId}/calculation-runs/${runId}/publish-snapshot`,
        { method: "POST" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? "Could not publish snapshot");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form action={handleCalculation} className="rounded-lg border border-slate-200 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Period">
            <Select name="reportingPeriodId" disabled={!canRun}>
              {periods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Methodology">
            <Select name="methodologyVersionId" disabled={!canRun}>
              {methodologies.map((methodology) => (
                <option key={methodology.id} value={methodology.id}>
                  {methodology.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Factor library">
            <Select name="factorLibraryId" disabled={!canRun}>
              {factorLibraries.map((library) => (
                <option key={library.id} value={library.id}>
                  {library.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Button type="submit" disabled={!canRun || isPending} className="mt-4">
          <Calculator className="h-4 w-4" />
          Run calculation
        </Button>
      </form>

      <form action={handlePublish} className="rounded-lg border border-slate-200 p-4">
        <Field label="Succeeded calculation run">
          <Select name="runId" disabled={!canPublish}>
            {succeededRuns.map((run) => (
              <option key={run.id} value={run.id}>
                {run.label}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" disabled={!canPublish || isPending} className="mt-4">
          <UploadCloud className="h-4 w-4" />
          Publish snapshot
        </Button>
      </form>
      {error && <p className="text-sm text-red-600 lg:col-span-2">{error}</p>}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs font-medium text-slate-600">{label}</Label>
      {children}
    </div>
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}
