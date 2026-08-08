"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface Run {
  id: string;
  status: string;
  errorMessage?: string | null;
  reportingPeriod: { label: string };
  factorLibrary: { name: string; version: string };
}

interface Props {
  orgId: string;
  initialRuns: Run[];
}

export function CalculationRunsLive({ orgId, initialRuns }: Props) {
  const router = useRouter();
  const [runs, setRuns] = useState<Run[]>(initialRuns);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wasInFlightRef = useRef(false);

  const hasInFlight = runs.some(
    (r) => r.status === "queued" || r.status === "running",
  );

  useEffect(() => {
    if (hasInFlight) {
      wasInFlightRef.current = true;
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/orgs/${orgId}/calculation-runs`);
          if (!res.ok) return;
          const data = await res.json();
          const fresh: Run[] = data.data ?? [];
          setRuns(fresh);
          const stillInFlight = fresh.some(
            (r) => r.status === "queued" || r.status === "running",
          );
          if (!stillInFlight) {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            router.refresh();
          }
        } catch {
          // network blip — keep polling
        }
      }, 3000);
    } else if (wasInFlightRef.current) {
      // Just resolved — refresh server data
      wasInFlightRef.current = false;
      router.refresh();
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [hasInFlight, orgId, router]);

  if (runs.length === 0) return null;

  return (
    <div className="grid gap-2">
      {hasInFlight && (
        <div className="flex items-center gap-3 rounded-[14px] border border-[#b6ced5] bg-[#b6ced5]/20 px-4 py-3">
          <Loader2 className="h-4 w-4 text-[#0f3e17] animate-spin shrink-0" />
          <div>
            <p className="text-sm font-normal text-[#0f3e17] tracking-[-0.42px]">
              Calculation in progress
            </p>
            <p className="text-xs text-[#333333] tracking-[-0.36px]">
              Updating automatically — no need to refresh.
            </p>
          </div>
        </div>
      )}
      {runs.map((run) => (
        <div
          key={run.id}
          className="flex flex-col gap-2 rounded-[14px] border border-[#e5e7eb] p-3 md:flex-row md:items-center md:justify-between"
        >
          <div>
            <p className="text-sm font-normal text-[#0f3e17] tracking-[-0.42px]">
              {run.reportingPeriod.label}
            </p>
            <p className="text-xs text-[#333333] tracking-[-0.36px]">
              {run.factorLibrary.name} {run.factorLibrary.version}
            </p>
            {run.status === "failed" && run.errorMessage && (
              <p className="mt-1 text-xs text-red-700 tracking-[-0.36px]">
                {run.errorMessage}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {(run.status === "queued" || run.status === "running") && (
              <Loader2 className="h-3.5 w-3.5 text-[#0f3e17] animate-spin" />
            )}
            <Badge
              variant={
                run.status === "succeeded"
                  ? "default"
                  : run.status === "failed"
                    ? "destructive"
                    : "outline"
              }
            >
              {run.status.replace(/_/g, " ")}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}
