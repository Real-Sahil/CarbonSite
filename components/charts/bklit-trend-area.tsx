"use client";

import { BarChart } from "./bar-chart";
import { Bar } from "./bar";

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
  { key: "scope1" as const, label: "Scope 1", color: "#0f766e" },
  { key: "scope2" as const, label: "Scope 2", color: "#0ea5e9" },
  { key: "scope3" as const, label: "Scope 3", color: "#84cc16" },
];

function tonnes(kg: number): string {
  if (kg === 0) return "0";
  return (kg / 1000).toLocaleString("en-GB", {
    maximumFractionDigits: 1,
  });
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
    <div
      role="img"
      aria-label="Emissions trend across reporting periods"
    >
      <BarChart
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
        <Bar dataKey="scope1" fill="#0f766e" lineCap="butt" />
        <Bar dataKey="scope2" fill="#0ea5e9" lineCap="butt" />
        <Bar dataKey="scope3" fill="#84cc16" lineCap="round" />
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
