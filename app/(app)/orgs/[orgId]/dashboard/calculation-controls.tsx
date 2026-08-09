"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import Link from "next/link";

interface CalculationControlsProps {
  orgId: string;
  periods: { id: string; label: string }[];
  methodologies: { id: string; label: string }[];
  factorLibraries: { id: string; label: string }[];
  succeededRuns: { id: string; status: string; label: string }[];
  approvedCountByPeriod: Record<string, number>;
}

type RunStatus = "queued" | "running" | "succeeded" | "failed";

interface RunResult {
  id: string;
  status: RunStatus;
  errorMessage?: string | null;
}

export function CalculationControls({
  orgId,
  periods,
  methodologies,
  factorLibraries,
  approvedCountByPeriod,
}: CalculationControlsProps) {
  const router = useRouter();
  const [periodId, setPeriodId] = useState(periods[0]?.id ?? "");
  const [methodologyId, setMethodologyId] = useState(methodologies[0]?.id ?? "");
  const [factorLibraryId, setFactorLibraryId] = useState(factorLibraries[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const [run, setRun] = useState<RunResult | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  useEffect(() => {
    return () => stopPolling();
  }, []);

  async function pollRunStatus(runId: string) {
    try {
      const res = await fetch(`/api/orgs/${orgId}/calculation-runs`);
      if (!res.ok) return;
      const data = await res.json();
      const found: RunResult | undefined = (data.data ?? []).find(
        (r: RunResult) => r.id === runId,
      );
      if (!found) return;
      setRun(found);
      if (found.status === "succeeded" || found.status === "failed") {
        stopPolling();
        router.refresh();
      }
    } catch {
      // network blip — keep polling
    }
  }

  function startPolling(runId: string) {
    stopPolling();
    pollRef.current = setInterval(() => pollRunStatus(runId), 3000);
  }

  async function handleRun() {
    if (!periodId || !methodologyId || !factorLibraryId) return;
    setRun(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/orgs/${orgId}/calculation-runs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportingPeriodId: periodId,
            methodologyVersionId: methodologyId,
            factorLibraryId,
          }),
        });
        if (res.status === 401) {
          window.location.href = "/sign-in";
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setRun({ id: "", status: "failed", errorMessage: data.message ?? "Failed to start calculation." });
          return;
        }
        const result: RunResult = {
          id: data.id ?? "",
          status: data.status ?? "queued",
          errorMessage: data.errorMessage ?? null,
        };
        setRun(result);
        if (result.status === "queued" || result.status === "running") {
          // Worker mode — poll until done
          startPolling(result.id);
        } else {
          // Inline mode — result is already final
          router.refresh();
        }
      } catch {
        setRun({ id: "", status: "failed", errorMessage: "Network error — try again." });
      }
    });
  }

  if (periods.length === 0 || methodologies.length === 0 || factorLibraries.length === 0) {
    return (
      <p className="text-sm text-[#374151] tracking-[-0.42px]">
        A reporting period, methodology version, and factor library are required before running a calculation.
      </p>
    );
  }

  const approvedCount = periodId ? (approvedCountByPeriod[periodId] ?? 0) : 0;
  const isInFlight = run?.status === "queued" || run?.status === "running";
  const isLoading = isPending || isInFlight;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#374151] tracking-[-0.36px]">Reporting period</label>
        <Select value={periodId} onValueChange={setPeriodId} disabled={isLoading}>
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
        <label className="text-xs text-[#374151] tracking-[-0.36px]">Methodology</label>
        <Select value={methodologyId} onValueChange={setMethodologyId} disabled={isLoading}>
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
        <label className="text-xs text-[#374151] tracking-[-0.36px]">Factor library</label>
        <Select value={factorLibraryId} onValueChange={setFactorLibraryId} disabled={isLoading}>
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
      <Button
        onClick={handleRun}
        disabled={isLoading || !periodId || !methodologyId || !factorLibraryId}
        size="sm"
        className="gap-1.5"
      >
        {isLoading ? (
          <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Play aria-hidden="true" className="h-3.5 w-3.5" />
        )}
        {isPending ? "Starting…" : isInFlight ? "Calculating…" : "Run calculation"}
      </Button>

      {/* No approved records warning */}
      {periodId && approvedCount === 0 && !run && (
        <div className="w-full flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-800 leading-relaxed">
            <span className="font-medium">No approved records for this period.</span>{" "}
            Approve{" "}
            <Link href={`/orgs/${orgId}/submissions`} className="underline underline-offset-2 hover:text-amber-900">
              field submissions
            </Link>{" "}
            or{" "}
            <Link href={`/orgs/${orgId}/records`} className="underline underline-offset-2 hover:text-amber-900">
              activity records
            </Link>{" "}
            first.
          </div>
        </div>
      )}

      {/* Approved record count */}
      {periodId && approvedCount > 0 && !run && (
        <p className="w-full flex items-center gap-1.5 text-xs text-[#111827] tracking-[-0.36px]">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {approvedCount.toLocaleString("en-GB")} approved record{approvedCount !== 1 ? "s" : ""} ready for this period.
        </p>
      )}

      {/* In-flight indicator */}
      {isInFlight && (
        <div className="w-full flex items-center gap-2 rounded-lg border border-[#BAE6FD] bg-[#F0F9FF]/20 px-3 py-2.5">
          <Loader2 className="h-4 w-4 text-[#111827] animate-spin shrink-0" />
          <div className="text-xs text-[#111827] leading-relaxed">
            <span className="font-medium">Calculating emissions…</span>{" "}
            This may take up to a minute. Results will update automatically.
          </div>
        </div>
      )}

      {/* Result: succeeded */}
      {run?.status === "succeeded" && (
        <div className="w-full flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="text-xs text-emerald-800 font-medium">
            Calculation complete. Dashboard updated.
          </span>
        </div>
      )}

      {/* Result: failed */}
      {run?.status === "failed" && run.errorMessage && (
        <div className="w-full flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
          <XCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
          <span className="text-xs text-red-800 leading-relaxed">{run.errorMessage}</span>
        </div>
      )}
    </div>
  );
}
