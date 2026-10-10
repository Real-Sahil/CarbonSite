"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { formatKpi, type KpiFormat } from "@/components/dashboard/kpi-format";

export type { KpiFormat };

export type KpiStat = {
  label: string;
  value: number | null;
  format: KpiFormat;
  /** Change against the comparison period. Omit when there is no comparison. */
  delta?: { value: number; label: string };
  /** True when a rise is good (e.g. diversion), false when a rise is bad (e.g. emissions). */
  goodUp?: boolean;
  /** Makes the whole card a link. */
  href?: string;
};

const DURATION_MS = 900;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Eases a displayed number from 0 to `target`. Reduced motion, or no value, shows the target at once. */
function useCountUp(target: number | null): number | null {
  const [shown, setShown] = useState<number | null>(target);
  useEffect(() => {
    if (target === null || prefersReducedMotion()) {
      setShown(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      setShown(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    setShown(0);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return shown;
}

function DeltaChip({ delta, goodUp }: { delta: { value: number; label: string }; goodUp: boolean }) {
  const flat = delta.value === 0;
  const up = delta.value > 0;
  const good = flat ? null : up === goodUp;
  const arrow = flat ? "→" : up ? "↑" : "↓";
  const tone = good === null ? "bg-[#F3F4F6] text-[#374151]" : good ? "bg-[#ECFDF5] text-[#047857]" : "bg-[#FEF2F2] text-[#B91C1C]";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", tone)}>
      <span aria-hidden="true">{arrow}</span>
      {delta.label}
    </span>
  );
}

/**
 * A row of KPI cards. Each value eases up once on mount, and the delta chip
 * says whether the change is good or bad using `goodUp`. It shows only the
 * values it is given: no simulated data.
 */
export function KpiStatRow({ stats }: { stats: KpiStat[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <KpiCard key={stat.label} stat={stat} />
      ))}
    </div>
  );
}

function KpiCard({ stat }: { stat: KpiStat }) {
  const shown = useCountUp(stat.value);
  const text = shown === null ? "No data" : formatKpi(stat.format, shown);
  const body = (
    <>
      <p className="text-xs text-[#6B7280]">{stat.label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-[#111827]" aria-live="off">
        {text}
      </p>
      {stat.delta && (
        <div className="mt-2">
          <DeltaChip delta={stat.delta} goodUp={stat.goodUp ?? false} />
        </div>
      )}
    </>
  );
  const className = "block rounded-[14px] border border-[#E5E7EB] bg-white p-4";
  if (stat.href) {
    return (
      <Link href={stat.href} className={cn(className, "transition-colors hover:bg-[#FFF7ED]")}>
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}
