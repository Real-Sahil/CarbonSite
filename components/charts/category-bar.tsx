"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AXIS_TICK,
  GRID_STROKE,
  formatTonnes,
  scopeColor,
  tonnesTick,
} from "./palette";

export interface CategoryBarDatum {
  /** Row label, e.g. an emission category or facility name. */
  name: string;
  /** Total emissions in kgCO2e. */
  value: number;
  /** Optional scope used to colour the bar; falls back to the default series colour. */
  scope?: number;
}

interface CategoryBarProps {
  data: CategoryBarDatum[];
  height?: number;
  ariaLabel?: string;
}

export function CategoryBar({
  data,
  height = 260,
  ariaLabel = "Emissions horizontal bar chart",
}: CategoryBarProps) {
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
    <div style={{ height }} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
        >
          <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
          <XAxis
            type="number"
            tick={AXIS_TICK}
            tickFormatter={tonnesTick}
            axisLine={{ stroke: GRID_STROKE }}
            tickLine={false}
            label={{
              value: "tCO2e",
              position: "insideBottomRight",
              offset: -2,
              fill: "#64748b",
              fontSize: 11,
            }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={150}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "#f1f5f9" }}
            formatter={(value) => [formatTonnes(Number(value)), "Emissions"]}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              fontSize: 12,
            }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {rows.map((row) => (
              <Cell key={row.name} fill={scopeColor(row.scope)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
