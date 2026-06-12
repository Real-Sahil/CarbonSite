"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play } from "lucide-react";

interface CalculationControlsProps {
  orgId: string;
  periods: { id: string; label: string }[];
  methodologies: { id: string; label: string }[];
  factorLibraries: { id: string; label: string }[];
  succeededRuns: { id: string; status: string; label: string }[];
}

export function CalculationControls({
  orgId,
  periods,
  methodologies,
  factorLibraries,
}: CalculationControlsProps) {
  const [periodId, setPeriodId] = useState(periods[0]?.id ?? "");
  const [methodologyId, setMethodologyId] = useState(methodologies[0]?.id ?? "");
  const [factorLibraryId, setFactorLibraryId] = useState(factorLibraries[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleRun() {
    if (!periodId || !methodologyId || !factorLibraryId) {
      setError("Select a period, methodology, and factor library to run a calculation.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`/api/orgs/${orgId}/calculation-runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportingPeriodId: periodId, methodologyVersionId: methodologyId, factorLibraryId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Failed to enqueue calculation run.");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Network error — try again.");
    } finally {
      setLoading(false);
    }
  }

  if (periods.length === 0 || methodologies.length === 0 || factorLibraries.length === 0) {
    return (
      <p className="text-sm text-[#333333] tracking-[-0.42px]">
        A reporting period, methodology version, and factor library are required before running a calculation.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#333333] tracking-[-0.36px]">Reporting period</label>
        <Select value={periodId} onValueChange={setPeriodId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            {periods.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#333333] tracking-[-0.36px]">Methodology</label>
        <Select value={methodologyId} onValueChange={setMethodologyId}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Select methodology" />
          </SelectTrigger>
          <SelectContent>
            {methodologies.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#333333] tracking-[-0.36px]">Factor library</label>
        <Select value={factorLibraryId} onValueChange={setFactorLibraryId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select library" />
          </SelectTrigger>
          <SelectContent>
            {factorLibraries.map((f) => (
              <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button onClick={handleRun} disabled={loading} size="sm" className="gap-1.5">
        <Play aria-hidden="true" className="h-3.5 w-3.5" />
        {loading ? "Enqueueing…" : "Run calculation"}
      </Button>
      {error && <p className="w-full text-sm text-red-600 tracking-[-0.42px]">{error}</p>}
      {success && (
        <p className="w-full text-sm text-[#0f3e17] tracking-[-0.42px]">
          Calculation run enqueued. Refresh in a moment to see status.
        </p>
      )}
    </div>
  );
}
