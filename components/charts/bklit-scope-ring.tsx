"use client";

import { RingChart } from "./ring-chart";
import { RingCenter } from "./ring-center";
import { Ring } from "./ring";
import type { RingData } from "./ring-context";

const SCOPE_COLORS = ["#0f766e", "#0ea5e9", "#84cc16"];

export interface ScopeRingDatum {
  scope: number;
  label: string;
  value: number;
}

interface BklitScopeRingProps {
  data: ScopeRingDatum[];
  height?: number;
}

export function BklitScopeRing({ data, height = 280 }: BklitScopeRingProps) {
  const rows = data.filter((d) => d.value > 0);
  const total = rows.reduce((s, d) => s + d.value, 0);

  if (rows.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-slate-500"
        style={{ height }}
      >
        No calculated emissions to chart.
      </div>
    );
  }

  const ringData: RingData[] = rows.map((d, i) => ({
    label: d.label,
    value: d.value,
    maxValue: total,
    color: SCOPE_COLORS[i % SCOPE_COLORS.length],
  }));

  return (
    <div style={{ height }} role="img" aria-label="Emissions by scope ring chart">
      <RingChart
        data={ringData}
        strokeWidth={14}
        ringGap={6}
        className="w-full h-full"
      >
        <RingCenter
          defaultLabel="tCO₂e"
          formatOptions={{ notation: "compact", maximumFractionDigits: 1 }}
        />
        {ringData.map((_item, i) => (
          <Ring key={i} index={i} />
        ))}
      </RingChart>
      <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1">
        {rows.map((d, i) => (
          <div key={d.scope} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
              style={{ background: SCOPE_COLORS[i % SCOPE_COLORS.length] }}
            />
            <span className="text-xs text-slate-600">
              {d.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
