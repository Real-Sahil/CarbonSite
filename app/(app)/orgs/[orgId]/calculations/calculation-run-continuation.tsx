"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface CalculationRunContinuationProps {
  orgId: string;
  /** Runs still "running" with more chunks left to process. */
  runIds: string[];
  intervalMs?: number;
}

/**
 * A calculation run large enough to need multiple chunks (see
 * lib/calculation/run-worker.ts) doesn't advance on its own between
 * requests — something has to call its continue endpoint again. While this
 * page is open, this does that: hitting continue for every run still in
 * progress, then refreshing so the page reflects new progress. If nobody
 * has the tab open, the stalled-run sweep
 * (app/api/admin/schedule/advance-calculation-runs) is the fallback.
 */
export function CalculationRunContinuation({ orgId, runIds, intervalMs = 4000 }: CalculationRunContinuationProps) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (runIds.length === 0) return;

    const tick = async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        await Promise.all(
          runIds.map((runId) =>
            fetch(`/api/orgs/${orgId}/calculation-runs/${runId}/continue`, { method: "POST" }).catch(() => {}),
          ),
        );
        router.refresh();
      } finally {
        inFlightRef.current = false;
      }
    };

    timerRef.current = setInterval(tick, intervalMs);
    return () => {
      if (timerRef.current !== null) clearInterval(timerRef.current);
    };
  }, [orgId, runIds, intervalMs, router]);

  return null;
}
