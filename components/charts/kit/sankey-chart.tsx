"use client";

import { useMemo, useState } from "react";
import { ParentSize } from "@visx/responsive";
import { sankey, sankeyLeft, sankeyLinkHorizontal, type SankeyLink, type SankeyNode } from "d3-sankey";
import type { Flows } from "@/lib/charts/sankey";
import { NEUTRAL_SERIES_COLOR, SCOPE_COLORS } from "@/components/charts/palette";
import { ChartFrame } from "./chart-frame";

type Datum = { id: string; label: string; kind: string; scope?: number };
type N = SankeyNode<Datum, object>;
type L = SankeyLink<Datum, object>;

const colour = (scope?: number) => (scope ? SCOPE_COLORS[scope] : NEUTRAL_SERIES_COLOR);
const tonnes = (kg: number, locale: string) => `${(kg / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })} tCO₂e`;

function Diagram({ flows, width, height, locale }: { flows: Flows; width: number; height: number; locale: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const layout = useMemo(() => {
    const labelRoom = 150;
    const g = sankey<Datum, object>()
      .nodeId((n) => n.id)
      .nodeAlign(sankeyLeft)
      .nodeWidth(12)
      .nodePadding(10)
      .extent([[4, 4], [Math.max(40, width - labelRoom), height - 4]]);
    return g({ nodes: flows.nodes.map((n) => ({ ...n })), links: flows.links.map((l) => ({ ...l })) });
  }, [flows, width, height]);

  const nodeOf = (l: L) => ({ s: l.source as N, t: l.target as N });
  const related = (id: string | null) => {
    if (!id) return null;
    const ids = new Set([id]);
    layout.links.forEach((l) => { const { s, t } = nodeOf(l); if (s.id === id || t.id === id) { ids.add(s.id!); ids.add(t.id!); } });
    return ids;
  };
  const rel = related(hover);
  const share = (v: number) => `${((v / flows.totalKg) * 100).toLocaleString(locale, { maximumFractionDigits: 1 })}%`;

  return (
    <svg width={width} height={height} role="group" aria-label="Emissions flow from scope to category to site">
      <g fill="none">
        {layout.links.map((l, i) => {
          const { s, t } = nodeOf(l);
          const dim = rel && !(rel.has(s.id!) && rel.has(t.id!));
          return (
            <path
              key={i}
              d={sankeyLinkHorizontal()(l as never) ?? ""}
              stroke={colour((s as unknown as { scope?: number }).scope)}
              strokeOpacity={dim ? 0.08 : 0.35}
              strokeWidth={Math.max(1, l.width ?? 1)}
            >
              <title>{`${(s as unknown as { label: string }).label} to ${(t as unknown as { label: string }).label}: ${tonnes(l.value, locale)}`}</title>
            </path>
          );
        })}
      </g>
      {layout.nodes.map((n) => {
        const node = n as N & { label: string; scope?: number; kind: string; value?: number };
        const v = node.value ?? 0;
        const dim = rel && !rel.has(node.id!);
        const x0 = node.x0 ?? 0, x1 = node.x1 ?? 0, y0 = node.y0 ?? 0, y1 = node.y1 ?? 0;
        return (
          <g
            key={node.id}
            tabIndex={0}
            role="img"
            aria-label={`${node.label}: ${tonnes(v, locale)}, ${share(v)} of the total`}
            opacity={dim ? 0.35 : 1}
            className="outline-none [&:focus-visible_rect]:stroke-[#111827] [&:focus-visible_rect]:stroke-2"
            onMouseEnter={() => setHover(node.id!)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(node.id!)}
            onBlur={() => setHover(null)}
          >
            <rect x={x0} y={y0} width={x1 - x0} height={Math.max(1, y1 - y0)} rx={2} fill={colour(node.scope)} />
            {y1 - y0 >= 14 || node.kind === "scope" ? (
              <text x={x1 + 6} y={(y0 + y1) / 2} dy="0.32em" fontSize={11} fill="#374151">
                {node.label.length > 22 ? `${node.label.slice(0, 21)}…` : node.label}
                <tspan fill="#6B7280" dx={4}>{tonnes(v, locale)}</tspan>
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

export function SankeyChart({ flows, locale = "en-GB", period }: { flows: Flows; locale?: string; period?: string }) {
  if (flows.totalKg <= 0) return null;
  const scopes = flows.nodes.filter((n) => n.kind === "scope");
  return (
    <ChartFrame
      title="Where the emissions flow"
      description={`Scope to category to site${period ? `, ${period}` : ""}. Hover or focus a block to follow it.`}
      table={{
        columns: ["From", "To", "tCO₂e", "Share of total"],
        rows: [...flows.links]
          .sort((a, b) => b.value - a.value)
          .map((l) => {
            const label = (id: string) => flows.nodes.find((n) => n.id === id)?.label ?? id;
            return [label(l.source), label(l.target), (l.value / 1000).toLocaleString(locale, { maximumFractionDigits: 2 }), `${((l.value / flows.totalKg) * 100).toLocaleString(locale, { maximumFractionDigits: 1 })}%`];
          }),
      }}
      footnote={`Total ${tonnes(flows.totalKg, locale)} across ${scopes.length} ${scopes.length === 1 ? "scope" : "scopes"}. Small categories and sites are grouped under Other; nothing is dropped.`}
    >
      <div className="h-[420px]">
        <ParentSize debounceTime={10}>{({ width, height }) => (width > 0 ? <Diagram flows={flows} width={width} height={height} locale={locale} /> : null)}</ParentSize>
      </div>
    </ChartFrame>
  );
}
