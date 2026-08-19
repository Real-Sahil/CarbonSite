"use client";

import { BarChart } from "./bar-chart";
import { Bar } from "./bar";

const SCOPE_COLORS: Record<number, string> = {
  1: "#0f766e",
  2: "#0ea5e9",
  3: "#84cc16",
};

export interface CategoryBarDatum {
  name: string;
  scope: number;
  value: number;
}

interface BklitCategoryBarProps {
  data: CategoryBarDatum[];
  ariaLabel?: string;
  height?: number;
}

function tonnes(kg: number): string {
  return (kg / 1000).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function BklitCategoryBar({
  data,
  ariaLabel = "Top emission categories bar chart",
  height = 260,
}: BklitCategoryBarProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-slate-500"
        style={{ height }}
        role="img"
        aria-label={ariaLabel}
      >
        No category data to chart.
      </div>
    );
  }

  const chartData = data.map((d) => ({
    name: d.name.length > 22 ? `${d.name.slice(0, 20)}…` : d.name,
    value: d.value,
    scope: d.scope,
    fill: SCOPE_COLORS[d.scope] ?? "#94a3b8",
  }));

  return (
    <div
      style={{ height }}
      role="img"
      aria-label={ariaLabel}
    >
      <BarChart
        data={chartData}
        xDataKey="name"
        orientation="horizontal"
        aspectRatio={`${height * 2} / ${height}`}
        className="w-full"
        margin={{ top: 8, right: 48, bottom: 8, left: 8 }}
        barGap={0.35}
        animationDuration={900}
      >
        <Bar
          dataKey="value"
          fill="#0ea5e9"
          lineCap="round"
          animationType="grow"
        />
      </BarChart>
      <div className="mt-2 flex flex-col gap-1">
        {data.map((d) => (
          <div key={d.name} className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="inline-block h-2 w-2 rounded-full shrink-0"
                style={{ background: SCOPE_COLORS[d.scope] ?? "#94a3b8" }}
              />
              <span className="truncate text-slate-600">{d.name}</span>
            </div>
            <span className="shrink-0 text-slate-500 tabular-nums">
              {tonnes(d.value)} tCO₂e
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
