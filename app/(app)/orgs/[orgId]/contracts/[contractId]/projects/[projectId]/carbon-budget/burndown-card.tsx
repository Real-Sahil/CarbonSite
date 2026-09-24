"use client";

import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Burndown } from "@/lib/project-carbon/burndown";

const STATUS = {
  over: { label: "Forecast over budget", cls: "border-red-200 bg-red-50 text-red-700" },
  at_risk: { label: "At risk", cls: "border-amber-200 bg-amber-50 text-amber-800" },
  on_track: { label: "On track", cls: "border-green-200 bg-green-50 text-green-700" },
  no_budget: { label: "No budget", cls: "border-gray-200 bg-gray-50 text-gray-600" },
} as const;

const METHOD = {
  evm: "Forecast from the phases' earned value (budget ÷ carbon performance index).",
  run_rate: "Forecast from the average of the last three months, carried to the project end date.",
  none: "No forecast yet: set the project's end date and record some carbon.",
} as const;

const t = (v: number | null, dp = 1) => (v == null ? "–" : v.toLocaleString("en-GB", { maximumFractionDigits: dp, minimumFractionDigits: dp }));
const monthLabel = (m: string) => {
  const [y, mm] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mm - 1, 1)).toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
};

export function BurndownCard({ burndown }: { burndown: Burndown }) {
  const s = STATUS[burndown.status];
  const data = burndown.points.map((p) => ({ ...p, label: monthLabel(p.month) }));

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Burn-down and forecast</h3>
          <p className="text-xs text-gray-500 mt-0.5 max-w-[60ch]">{METHOD[burndown.method]}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-6 py-4 border-b border-gray-100">
        <Stat label="Measured to date" value={`${t(burndown.actualToDate)} t`} />
        <Stat label="Planned to date" value={burndown.plannedToDate == null ? "Needs project dates" : `${t(burndown.plannedToDate)} t`} />
        <Stat label="Forecast at completion" value={burndown.forecastAtCompletion == null ? "–" : `${t(burndown.forecastAtCompletion)} t`} />
        <Stat
          label="Variance at completion"
          value={burndown.varianceAtCompletion == null ? "–" : `${burndown.varianceAtCompletion >= 0 ? "" : "+"}${t(Math.abs(burndown.varianceAtCompletion))} t ${burndown.varianceAtCompletion >= 0 ? "under" : "over"}`}
          tone={burndown.varianceAtCompletion == null ? undefined : burndown.varianceAtCompletion >= 0 ? "good" : "bad"}
        />
      </div>

      {burndown.reasons.length > 0 && (
        <ul className="px-6 pt-4 text-sm text-gray-700 list-disc list-inside">
          {burndown.reasons.map((r) => <li key={r}>{r}</li>)}
        </ul>
      )}

      {data.length > 1 ? (
        <div className="h-64 px-2 py-4">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6B7280" }} tickLine={false} axisLine={{ stroke: "#E5E7EB" }} minTickGap={16} />
              <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} tickLine={false} axisLine={false} width={48} />
              <Tooltip
                formatter={(v, name) => [v == null ? "–" : `${t(Number(v))} tCO₂e`, String(name)]}
                contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#E5E7EB" }}
              />
              <ReferenceLine y={burndown.budgetTco2e} stroke="#DC2626" strokeDasharray="4 4" label={{ value: "Budget", position: "insideTopLeft", fontSize: 11, fill: "#DC2626" }} />
              <Area type="monotone" dataKey="cumulativeActual" name="Measured (cumulative)" stroke="#f97316" fill="#FFEDD5" strokeWidth={2} connectNulls={false} />
              <Line type="linear" dataKey="plannedCumulative" name="Planned" stroke="#9CA3AF" strokeDasharray="2 3" dot={false} />
              <Line type="linear" dataKey="forecastCumulative" name="Forecast" stroke="#111827" strokeDasharray="6 4" dot={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="px-6 py-6 text-sm text-gray-500">The chart appears once there are two months of project dates or measured carbon.</p>
      )}
      <p className="px-6 pb-4 text-xs text-gray-500">
        Measured carbon is approved activity on the project&apos;s sites by activity month, plus embodied carbon records by the month recorded.
        The planned line spreads the budget evenly between the project&apos;s start and end dates.
      </p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-base font-semibold tabular-nums ${tone === "good" ? "text-green-700" : tone === "bad" ? "text-red-600" : "text-gray-900"}`}>{value}</div>
    </div>
  );
}
