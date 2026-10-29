"use client";

// The dashboard's site plot: pan by dragging, zoom with the buttons, a pinch or ctrl/cmd + wheel, hover or focus a pin
// for its figures. Plain scrolling is left alone so the page never gets stuck under a finger or a wheel. A pin click
// still hands the site to the parent, which filters the dashboard.

import { useId, useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { radiusFor, type SiteTotal } from "@/lib/map/site-map";
import { SCOPE_COLORS } from "@/components/charts/palette";

export const MAP_W = 720;
export const MAP_H = 300;
const MIN_K = 1;
const MAX_K = 10;
const DRAG_PX = 4;

type View = { k: number; tx: number; ty: number };
const HOME: View = { k: 1, tx: 0, ty: 0 };

export type Spot = { x: number; y: number; site: SiteTotal };

// Keeps the plot from being dragged off its own frame.
function clampView(v: View): View {
  const k = Math.min(MAX_K, Math.max(MIN_K, v.k));
  return {
    k,
    tx: Math.min(0, Math.max(MAP_W - MAP_W * k, v.tx)),
    ty: Math.min(0, Math.max(MAP_H - MAP_H * k, v.ty)),
  };
}

function zoomAt(v: View, factor: number, cx: number, cy: number): View {
  const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor));
  const ratio = k / v.k;
  return clampView({ k, tx: cx - (cx - v.tx) * ratio, ty: cy - (cy - v.ty) * ratio });
}

export function SiteHeroMap({
  spots,
  max,
  labelled,
  isOn,
  onPick,
  formatKg,
}: {
  spots: Spot[];
  max: number;
  labelled: Set<string>;
  isOn: (s: SiteTotal) => boolean;
  onPick: (s: SiteTotal) => void;
  formatKg: (kg: number) => string;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>(HOME);
  const [hover, setHover] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const gridId = useId();
  // Active pointers, for drag (one) and pinch (two). Positions are in plot units.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ moved: boolean; startX: number; startY: number; pinch: number } | null>(null);

  const toPlot = (clientX: number, clientY: number) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: ((clientX - r.left) * MAP_W) / r.width, y: ((clientY - r.top) * MAP_H) / r.height };
  };
  const centre = { x: MAP_W / 2, y: MAP_H / 2 };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.set(e.pointerId, toPlot(e.clientX, e.clientY));
    const pts = [...pointers.current.values()];
    gesture.current = {
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      pinch: pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0,
    };
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const prev = pointers.current.get(e.pointerId);
    const g = gesture.current;
    if (!prev || !g) return;
    const now = toPlot(e.clientX, e.clientY);
    pointers.current.set(e.pointerId, now);
    const pts = [...pointers.current.values()];
    if (pts.length >= 2) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (g.pinch > 0 && dist > 0) {
        g.moved = true;
        setDragging(true);
        setView((v) => zoomAt(v, dist / g.pinch, (pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2));
      }
      g.pinch = dist;
      return;
    }
    if (!g.moved && Math.hypot(e.clientX - g.startX, e.clientY - g.startY) < DRAG_PX) return;
    if (!g.moved) {
      g.moved = true;
      setDragging(true);
      // Capture only once it is a drag, so a plain tap still reaches the pin under the finger.
      svg.current?.setPointerCapture(e.pointerId);
    }
    setView((v) => clampView({ ...v, tx: v.tx + (now.x - prev.x), ty: v.ty + (now.y - prev.y) }));
  };

  const endPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      setDragging(false);
      // The click that follows a drag must not pick the pin the drag ended on.
      if (gesture.current?.moved) {
        const swallow = (ev: Event) => ev.stopPropagation();
        window.addEventListener("click", swallow, { capture: true, once: true });
        setTimeout(() => window.removeEventListener("click", swallow, true), 0);
      }
      gesture.current = null;
    }
  };

  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    if (!e.ctrlKey && !e.metaKey) return;
    const p = toPlot(e.clientX, e.clientY);
    setView((v) => zoomAt(v, e.deltaY < 0 ? 1.25 : 0.8, p.x, p.y));
  };

  const hovered = spots.find((s) => s.site.id === hover);
  const btn =
    "inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#CBD2D9] bg-white text-[#41505F] shadow-sm hover:bg-[#F9FAFC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#c2400c] disabled:opacity-40";

  return (
    <div className="relative">
      <svg
        ref={svg}
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        className={`block h-auto w-full select-none rounded-[10px] border border-[#CBD2D9] bg-[#F9FAFC] ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
        style={{ touchAction: "pan-y" }}
        role="group"
        aria-label="Sites on a schematic, sized by emissions. Drag to pan, use the buttons to zoom. The list beside it gives the same figures."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onWheel={onWheel}
      >
        <defs>
          <pattern id={gridId} width={60} height={60} patternUnits="userSpaceOnUse" patternTransform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#E3E8EE" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          </pattern>
        </defs>
        <rect width={MAP_W} height={MAP_H} fill={`url(#${gridId})`} />
        {spots.map(({ x, y, site: s }) => {
          const px = x * view.k + view.tx;
          const py = y * view.k + view.ty;
          // A pin panned off the plot is not drawn, but stays in the list beside it.
          if (px < -40 || px > MAP_W + 40 || py < -40 || py > MAP_H + 40) return null;
          const r = radiusFor(s.kg, max);
          const on = isOn(s);
          const colour = s.kind === "site" ? SCOPE_COLORS[0] : SCOPE_COLORS[1];
          const showName = view.k >= 2 || labelled.has(s.id) || hover === s.id;
          return (
            <g
              key={s.id}
              role="button"
              tabIndex={0}
              aria-pressed={on}
              aria-label={`${s.name}, ${formatKg(s.kg)}`}
              className="cursor-pointer outline-none focus-visible:[&>circle]:stroke-[#111827]"
              onClick={() => onPick(s)}
              onPointerEnter={() => setHover(s.id)}
              onPointerLeave={() => setHover((h) => (h === s.id ? null : h))}
              onFocus={() => setHover(s.id)}
              onBlur={() => setHover((h) => (h === s.id ? null : h))}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onPick(s);
                }
              }}
            >
              <circle cx={px} cy={py} r={r} fill={colour} fillOpacity={on ? 0.85 : 0.5} stroke={on ? "#111827" : colour} strokeWidth={on ? 3 : 1.5} />
              {showName ? (
                <text x={px} y={py - r - 6} textAnchor="middle" fontSize={11} fill="#374151" paintOrder="stroke" stroke="#F9FAFC" strokeWidth={3} strokeLinejoin="round">
                  {s.name}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      {hovered ? (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 max-w-[220px] -translate-x-1/2 -translate-y-full rounded-md bg-[#131d29] px-2.5 py-1.5 text-xs text-white shadow-lg"
          style={{
            left: `${Math.min(88, Math.max(12, ((hovered.x * view.k + view.tx) / MAP_W) * 100))}%`,
            top: `${Math.max(14, ((hovered.y * view.k + view.ty - radiusFor(hovered.site.kg, max) - 6) / MAP_H) * 100)}%`,
          }}
        >
          <span className="block truncate font-medium">{hovered.site.name}</span>
          <span className="block tabular-nums text-white/80">{formatKg(hovered.site.kg)} · {hovered.site.kind === "site" ? "Project site" : "Office or depot"}</span>
        </div>
      ) : null}

      <div className="absolute right-2 top-2 flex flex-col gap-1" role="group" aria-label="Map zoom">
        <button type="button" className={btn} aria-label="Zoom in" disabled={view.k >= MAX_K} onClick={() => setView((v) => zoomAt(v, 1.6, centre.x, centre.y))}>
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" className={btn} aria-label="Zoom out" disabled={view.k <= MIN_K} onClick={() => setView((v) => zoomAt(v, 1 / 1.6, centre.x, centre.y))}>
          <Minus className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" className={btn} aria-label="Reset view" disabled={view.k === 1 && view.tx === 0 && view.ty === 0} onClick={() => setView(HOME)}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
