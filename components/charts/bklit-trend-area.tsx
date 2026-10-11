"use client";

import type { ReactNode } from "react";
import { BarChart } from "./bar-chart";
import { Bar } from "./bar";
import { SCOPE_COLORS, formatTonnes } from "./palette";

export interface TrendLineDatum {
  label: string;
  scope1: number;
  scope2: number;
  scope3: number;
}

interface BklitTrendAreaProps {
  data: TrendLineDatum[];
  height?: number;
}

const SCOPE_SERIES = [
  { key: "scope1" as const, label: "Scope 1", color: SCOPE_COLORS[1] },
  { key: "scope2" as const, label: "Scope 2", color: SCOPE_COLORS[2] },
  { key: "scope3" as const, label: "Scope 3", color: SCOPE_COLORS[3] },
];

/** Hover or arrow-key readout: the period, each scope in tonnes, and the stacked total. */
function trendReadout(point: Record<string, unknown>): ReactNode {
  const rows = SCOPE_SERIES.map((s) => ({
    label: s.label,
    color: s.color,
    kg: Number(point[s.key]) || 0,
  }));
  const total = rows.reduce((sum, r) => sum + r.kg, 0);
  return (
    <div className="flex flex-col gap-1">
      <span className="font-medium text-slate-900">{String(point.name ?? "")}</span>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ background: r.color }} />
            {r.label}
          </span>
          <span className="tabular-nums text-slate-900">{formatTonnes(r.kg)}</span>
        </div>
      ))}
      <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-1">
        <span className="text-slate-600">Total</span>
        <span className="tabular-nums font-medium text-slate-900">{formatTonnes(total)}</span>
      </div>
    </div>
  );
}

export function BklitTrendArea({ data, height = 260 }: BklitTrendAreaProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-slate-500"
        style={{ height }}
        role="img"
        aria-label="Emissions trend across reporting periods"
      >
        No period trend data to chart.
      </div>
    );
  }

  const chartData = data.map((d) => ({
    name: d.label,
    scope1: d.scope1,
    scope2: d.scope2,
    scope3: d.scope3,
  }));

  return (
    <div>
      <BarChart
        expandTitle="Emissions trend"
        ariaLabel="Emissions trend across reporting periods"
        readout={trendReadout}
        data={chartData}
        xDataKey="name"
        orientation="vertical"
        stacked
        aspectRatio={`${height * 2} / ${height}`}
        className="w-full"
        margin={{ top: 8, right: 16, bottom: 32, left: 16 }}
        barGap={0.25}
        animationDuration={1000}
      >
        {SCOPE_SERIES.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            fill={s.color}
            lineCap={i === SCOPE_SERIES.length - 1 ? "round" : "butt"}
          />
        ))}
      </BarChart>
      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
        {SCOPE_SERIES.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
              style={{ background: s.color }}
            />
            <span className="text-xs text-slate-600">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
