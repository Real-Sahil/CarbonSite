"use client";

import { useMemo, useState } from "react";
import { ParentSize } from "@visx/responsive";
import { scaleLinear } from "@visx/scale";
import { curveLinear, curveStepAfter, line as d3line } from "d3-shape";
import type { PathwayPoint } from "@/lib/transition-plan";
import { NEUTRAL_SERIES_COLOR, SCOPE_COLORS } from "@/components/charts/palette";
import { ChartFrame } from "./chart-frame";

// Series keep the validated scope palette (teal, ember, blue) plus the neutral
// slate; identity never rests on colour alone: the benchmark is dashed, the
// target solid thin, the plan a step line and the actuals dots.
const SERIES = [
  { key: "reference", label: "1.5°C benchmark", color: SCOPE_COLORS[1], dash: "5 4" },
  { key: "target", label: "Your target", color: NEUTRAL_SERIES_COLOR, dash: undefined },
  { key: "planned", label: "Planned (scheduled initiatives)", color: SCOPE_COLORS[2], dash: undefined },
  { key: "actual", label: "Published actual", color: SCOPE_COLORS[3], dash: undefined },
] as const;

const M = { top: 12, right: 16, bottom: 28, left: 64 };
const fmt = (v: number | null | undefined, locale: string) =>
  v == null ? "-" : `${v.toLocaleString(locale, { maximumFractionDigits: 0 })} tCO₂e`;

function Plot({ points, width, height, locale }: { points: PathwayPoint[]; width: number; height: number; locale: string }) {
  const [active, setActive] = useState<number | null>(null);
  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = Math.max(0, height - M.top - M.bottom);
  const years = points.map((p) => p.year);
  const max = Math.max(1, ...points.flatMap((p) => [p.reference, p.target ?? 0, p.planned, p.actual ?? 0]));
  const x = useMemo(() => scaleLinear({ domain: [Math.min(...years), Math.max(...years)], range: [0, innerW] }), [years, innerW]);
  const y = useMemo(() => scaleLinear({ domain: [0, max * 1.05], range: [innerH, 0], nice: true }), [max, innerH]);
  const path = (key: "reference" | "target" | "planned", curve: typeof curveLinear) =>
    d3line<PathwayPoint>()
      .defined((p) => p[key] != null)
      .x((p) => x(p.year))
      .y((p) => y(p[key] as number))
      .curve(curve)(points) ?? "";

  const idx = active == null ? null : Math.min(points.length - 1, Math.max(0, active));
  const cur = idx == null ? null : points[idx];
  const nearest = (clientX: number, el: SVGSVGElement) => {
    const rect = el.getBoundingClientRect();
    const yr = x.invert(clientX - rect.left - M.left);
    let best = 0;
    points.forEach((p, i) => { if (Math.abs(p.year - yr) < Math.abs(points[best].year - yr)) best = i; });
    return best;
  };

  return (
    <div className="relative">
      <svg
        width={width}
        height={height}
        role="application"
        aria-roledescription="line chart"
        aria-label="Emissions pathway. Use the left and right arrow keys to move between years."
        tabIndex={0}
        className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
        onMouseMove={(e) => setActive(nearest(e.clientX, e.currentTarget))}
        onMouseLeave={() => setActive(null)}
        onFocus={() => setActive((a) => a ?? 0)}
        onBlur={() => setActive(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); setActive((a) => Math.min(points.length - 1, (a ?? -1) + 1)); }
          if (e.key === "ArrowLeft") { e.preventDefault(); setActive((a) => Math.max(0, (a ?? 1) - 1)); }
          if (e.key === "Home") setActive(0);
          if (e.key === "End") setActive(points.length - 1);
          if (e.key === "Escape") setActive(null);
        }}
      >
        <g transform={`translate(${M.left},${M.top})`}>
          {y.ticks(5).map((t) => (
            <g key={t}>
              <line x1={0} x2={innerW} y1={y(t)} y2={y(t)} stroke="#F3F4F6" />
              <text x={-8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="#6B7280">{t.toLocaleString(locale)}</text>
            </g>
          ))}
          {x.ticks(Math.min(8, points.length)).filter(Number.isInteger).map((t) => (
            <text key={t} x={x(t)} y={innerH + 18} textAnchor="middle" fontSize={11} fill="#6B7280">{t}</text>
          ))}
          <line x1={0} x2={innerW} y1={innerH} y2={innerH} stroke="#E5E7EB" />
          <path d={path("reference", curveLinear)} fill="none" stroke={SERIES[0].color} strokeWidth={2} strokeDasharray={SERIES[0].dash} />
          <path d={path("target", curveLinear)} fill="none" stroke={SERIES[1].color} strokeWidth={1.5} />
          <path d={path("planned", curveStepAfter)} fill="none" stroke={SERIES[2].color} strokeWidth={2} />
          {points.filter((p) => p.actual != null).map((p) => (
            <circle key={p.year} cx={x(p.year)} cy={y(p.actual!)} r={4.5} fill={SERIES[3].color} stroke="#FFFFFF" strokeWidth={2} />
          ))}
          {cur ? (
            <g pointerEvents="none">
              <line x1={x(cur.year)} x2={x(cur.year)} y1={0} y2={innerH} stroke="#9CA3AF" strokeDasharray="2 3" />
              {SERIES.map((s) => {
                const v = cur[s.key];
                return v == null ? null : <circle key={s.key} cx={x(cur.year)} cy={y(v)} r={4} fill="#FFFFFF" stroke={s.color} strokeWidth={2} />;
              })}
            </g>
          ) : null}
        </g>
      </svg>
      {cur ? (
        <div
          className="pointer-events-none absolute top-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs shadow-sm"
          style={{ left: Math.min(Math.max(M.left + x(cur.year) + 12, 8), Math.max(8, width - 230)) }}
        >
          <div className="mb-1 font-medium text-[#111827]">{cur.year}</div>
          {SERIES.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-4 text-[#374151]">
              <span className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-0.5 w-3" style={{ background: s.color }} />{s.label}</span>
              <span className="tabular-nums">{fmt(cur[s.key], locale)}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="sr-only" aria-live="polite">
        {cur ? `${cur.year}. ${SERIES.map((s) => `${s.label} ${fmt(cur[s.key], locale)}`).join(". ")}` : ""}
      </div>
    </div>
  );
}

export function PathwayChartKit({ points, locale = "en-GB" }: { points: PathwayPoint[]; locale?: string }) {
  return (
    <ChartFrame
      title="Emissions pathway"
      description="Your published actuals against the 1.5°C benchmark, your target and the plan from scheduled initiatives."
      table={{
        columns: ["Year", ...SERIES.map((s) => s.label)],
        rows: points.map((p) => [p.year, ...SERIES.map((s) => fmt(p[s.key], locale))]),
      }}
      footnote="A scheduled initiative counts toward the planned line only with a start date and an abatement figure."
    >
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#374151]">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <svg width="18" height="8" aria-hidden>
              {s.key === "actual" ? <circle cx="9" cy="4" r="3.5" fill={s.color} /> : <line x1="0" x2="18" y1="4" y2="4" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash} />}
            </svg>
            {s.label}
          </span>
        ))}
      </div>
      <div className="h-72">
        <ParentSize debounceTime={10}>{({ width, height }) => (width > 0 ? <Plot points={points} width={width} height={height} locale={locale} /> : null)}</ParentSize>
      </div>
    </ChartFrame>
  );
}
