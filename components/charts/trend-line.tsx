"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AXIS_TICK,
  GRID_STROKE,
  SCOPE_COLORS,
  formatTonnes,
  tonnesTick,
} from "./palette";

export interface TrendLineDatum {
  /** Reporting period label, e.g. "FY 2025 Q1". */
  label: string;
  /** Scope totals in kgCO2e. */
  scope1: number;
  scope2: number;
  scope3: number;
}

interface TrendLineProps {
  data: TrendLineDatum[];
  height?: number;
}

const SERIES: { key: keyof TrendLineDatum; name: string; scope: number }[] = [
  { key: "scope1", name: "Scope 1", scope: 1 },
  { key: "scope2", name: "Scope 2", scope: 2 },
  { key: "scope3", name: "Scope 3", scope: 3 },
];

export function TrendLine({ data, height = 260 }: TrendLineProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-slate-500"
        style={{ height }}
      >
        No period trend data to chart.
      </div>
    );
  }

  return (
    <div style={{ height }} role="img" aria-label="Emissions trend across reporting periods">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
          <CartesianGrid vertical={false} stroke={GRID_STROKE} />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            axisLine={{ stroke: GRID_STROKE }}
            tickLine={false}
          />
          <YAxis
            tick={AXIS_TICK}
            tickFormatter={tonnesTick}
            axisLine={false}
            tickLine={false}
            label={{
              value: "tCO2e",
              angle: -90,
              position: "insideLeft",
              fill: "#64748b",
              fontSize: 11,
            }}
          />
          <Tooltip
            formatter={(value, name) => [formatTonnes(Number(value)), String(name)]}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              fontSize: 12,
            }}
          />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={9}
            formatter={(value) => (
              <span className="text-xs text-slate-600">{value}</span>
            )}
          />
          {SERIES.map((series) => (
            <Line
              key={series.key}
              type="monotone"
              dataKey={series.key}
              name={series.name}
              stroke={SCOPE_COLORS[series.scope]}
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 0, fill: SCOPE_COLORS[series.scope] }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
