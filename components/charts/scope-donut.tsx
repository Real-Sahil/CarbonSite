"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { formatTonnes, scopeColor } from "./palette";

export interface ScopeDonutDatum {
  /** GHG Protocol scope number (1, 2, or 3). */
  scope: number;
  /** Display label, e.g. "Scope 1". */
  label: string;
  /** Total emissions in kgCO2e. */
  value: number;
}

interface ScopeDonutProps {
  data: ScopeDonutDatum[];
  height?: number;
}

export function ScopeDonut({ data, height = 260 }: ScopeDonutProps) {
  const rows = data.filter((row) => Number.isFinite(row.value) && row.value > 0);

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

  return (
    <div style={{ height }} role="img" aria-label="Emissions by scope donut chart">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={rows}
            dataKey="value"
            nameKey="label"
            innerRadius="58%"
            outerRadius="85%"
            paddingAngle={2}
            strokeWidth={1}
            stroke="#ffffff"
          >
            {rows.map((row) => (
              <Cell key={row.scope} fill={scopeColor(row.scope)} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [formatTonnes(Number(value)), "Emissions"]}
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
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
