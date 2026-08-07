"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface StatusPollerProps {
  /** Poll interval in ms. Defaults to 5000. */
  intervalMs?: number;
  /** If false, the poller is idle (e.g. no in-flight jobs). */
  active?: boolean;
}

/**
 * Invisible client component that refreshes server data while jobs are in
 * flight. Drop it anywhere in a page that renders live status; it does
 * nothing when `active` is false so dead-pages pay zero cost.
 */
export function StatusPoller({ intervalMs = 5000, active = true }: StatusPollerProps) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) return;

    timerRef.current = setInterval(() => {
      router.refresh();
    }, intervalMs);

    return () => {
      if (timerRef.current !== null) clearInterval(timerRef.current);
    };
  }, [active, intervalMs, router]);

  return null;
}
