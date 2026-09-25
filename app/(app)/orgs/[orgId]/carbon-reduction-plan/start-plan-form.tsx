"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FieldRow, inputCls } from "@/components/structured-forms/ms-fields";

export function StartPlanForm({ orgId, periods }: { orgId: string; periods: { id: string; label: string }[] }) {
  const router = useRouter();
  const [periodId, setPeriodId] = useState(periods[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/carbon-reduction-plans`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reportingPeriodId: periodId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? "The plan could not be started.");
      router.push(`/orgs/${orgId}/carbon-reduction-plan/${body.plan.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The plan could not be started.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-[220px]">
        <FieldRow label="Reporting period" htmlFor="crp-period">
          <select id="crp-period" className={inputCls} value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </FieldRow>
      </div>
      <button
        onClick={start}
        disabled={busy || !periodId}
        className="h-9 rounded bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {busy ? "Starting…" : "Start guided plan"}
      </button>
      {error ? <p role="alert" className="w-full text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
