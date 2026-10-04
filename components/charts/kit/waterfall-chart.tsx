"use client";

import { ParentSize } from "@visx/responsive";
import { scaleBand, scaleLinear } from "@visx/scale";
import type { WaterfallStep } from "@/lib/charts/waterfall";
import { NEUTRAL_SERIES_COLOR, SCOPE_COLORS } from "@/components/charts/palette";
import { ChartFrame } from "./chart-frame";
import { useState } from "react";

// Direction is carried by the sign and an arrow in every label, as well as by
// colour: ember for an increase, teal for a decrease, slate for the totals.
const UP = SCOPE_COLORS[2];
const DOWN = SCOPE_COLORS[1];
const M = { top: 20, right: 12, bottom: 64, left: 56 };
const t = (kg: number, locale: string, signed = false) =>
  `${signed && kg > 0 ? "+" : ""}${(kg / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })}`;

/** Only a real category step can filter; totals and the grouped remainder cannot. */
export const stepCategory = (s: { id: string; kind: string }) => (s.kind === "change" && s.id !== "other" ? s.id : null);

function Plot({ steps, width, height, locale, onSelect, selected }: { steps: WaterfallStep[]; width: number; height: number; locale: string; onSelect?: (categoryId: string) => void; selected?: string }) {
  const [focus, setFocus] = useState<string | null>(null);
  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = Math.max(0, height - M.top - M.bottom);
  const x = scaleBand({ domain: steps.map((s) => s.id), range: [0, innerW], padding: 0.25 });
  const max = Math.max(1, ...steps.flatMap((s) => [s.from, s.to]));
  const y = scaleLinear({ domain: [0, max * 1.08], range: [innerH, 0], nice: true });
  return (
    <svg width={width} height={height} role="group" aria-label="Change in emissions by category between two periods">
      <g transform={`translate(${M.left},${M.top})`}>
        {y.ticks(5).map((v) => (
          <g key={v}>
            <line x1={0} x2={innerW} y1={y(v)} y2={y(v)} stroke="#F3F4F6" />
            <text x={-8} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill="#6B7280">{t(v, locale)}</text>
          </g>
        ))}
        {steps.map((s, i) => {
          const bx = x(s.id) ?? 0;
          const bw = x.bandwidth();
          const top = y(Math.max(s.from, s.to));
          const bottom = y(Math.min(s.from, s.to));
          const fill = s.kind === "total" ? NEUTRAL_SERIES_COLOR : s.value >= 0 ? UP : DOWN;
          const label = s.kind === "total" ? t(s.value, locale) : `${s.value >= 0 ? "▲" : "▼"} ${t(s.value, locale, true)}`;
          const next = steps[i + 1];
          const cat = onSelect ? stepCategory(s) : null;
          return (
            <g
              key={s.id}
              tabIndex={0}
              role={cat ? "button" : "img"}
              aria-pressed={cat ? selected === cat : undefined}
              style={cat ? { cursor: "pointer" } : undefined}
              onClick={cat ? () => onSelect!(cat) : undefined}
              onKeyDown={cat ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect!(cat); } } : undefined}
              aria-label={`${s.label}: ${s.kind === "total" ? `${t(s.value, locale)} tonnes` : `${s.value >= 0 ? "up" : "down"} ${t(Math.abs(s.value), locale)} tonnes`}${cat ? ". Press Enter to filter the dashboard to this category" : ""}`}
              className="outline-none [&:focus-visible_rect]:stroke-[#111827] [&:focus-visible_rect]:stroke-2"
              opacity={focus && focus !== s.id ? 0.6 : 1}
              onMouseEnter={() => setFocus(s.id)}
              onMouseLeave={() => setFocus(null)}
              onFocus={() => setFocus(s.id)}
              onBlur={() => setFocus(null)}
            >
              <rect x={bx} y={top} width={bw} height={Math.max(2, bottom - top)} rx={3} fill={fill} />
              {next ? <line x1={bx + bw} x2={x(next.id) ?? bx} y1={y(s.to)} y2={y(s.to)} stroke="#9CA3AF" strokeDasharray="2 2" /> : null}
              <text x={bx + bw / 2} y={top - 6} textAnchor="middle" fontSize={11} fill="#111827" className="tabular-nums">{label}</text>
              <text transform={`translate(${bx + bw / 2},${innerH + 14}) rotate(30)`} fontSize={11} fill="#374151">
                {s.label.length > 18 ? `${s.label.slice(0, 17)}…` : s.label}
              </text>
            </g>
          );
        })}
        <line x1={0} x2={innerW} y1={innerH} y2={innerH} stroke="#E5E7EB" />
      </g>
    </svg>
  );
}

export function WaterfallChart({ steps, locale = "en-GB", onSelect, selected }: { steps: WaterfallStep[]; locale?: string; onSelect?: (categoryId: string) => void; selected?: string }) {
  const start = steps[0];
  const end = steps[steps.length - 1];
  if (!start || !end || steps.length < 2) return null;
  return (
    <ChartFrame
      title="What changed since the previous period"
      description={`${start.label} to ${end.label}, by emission category, in tCO₂e.`}
      table={{
        columns: ["Step", "tCO₂e", "Running total"],
        rows: steps.map((s) => [s.label, s.kind === "total" ? t(s.value, locale) : t(s.value, locale, true), t(s.to, locale)]),
      }}
      footnote="Live figures for both periods. Increases are ember, decreases teal, totals slate; every bar is also labelled with its sign."
    >
      <div className="h-80">
        <ParentSize debounceTime={10}>{({ width, height }) => (width > 0 ? <Plot steps={steps} width={width} height={height} locale={locale} onSelect={onSelect} selected={selected} /> : null)}</ParentSize>
      </div>
    </ChartFrame>
  );
}
