"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
} from "lightweight-charts";
import { Download, Maximize2, Minimize2, RotateCcw } from "lucide-react";
import { cumulative, rangeStart, sma, type Point } from "./series-math";

// Canvas time-series chart on TradingView's Lightweight Charts (Apache-2.0,
// docs/THIRD_PARTY_SOURCES.md). Canvas keeps pan, wheel zoom, pinch and kinetic
// scroll smooth at thousands of points. The library's on-chart logo is off; the
// credit its licence asks for is a text link in the marketing site footer.

type Kind = "area" | "line" | "bars";
type Range = "1M" | "3M" | "6M" | "YTD" | "All";
const RANGES: Range[] = ["1M", "3M", "6M", "YTD", "All"];
const KINDS: { id: Kind; label: string }[] = [
  { id: "area", label: "Area" },
  { id: "line", label: "Line" },
  { id: "bars", label: "Bars" },
];
const SMA_WINDOW = 7;

const THEMES = {
  light: { text: "#64748b", grid: "#e2e8f0", line: "#0f766e", avg: "#c2400c", bg: "#ffffff" },
  dark: { text: "#94a3b8", grid: "#1e293b", line: "#2dd4bf", avg: "#f3713d", bg: "#0b1220" },
};

function useTheme(): "light" | "dark" {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const read = () =>
      setTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);
  return theme;
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmtDate = (t: string) => dateFmt.format(new Date(`${t}T00:00:00Z`));

export function ProTimeSeries({
  data,
  unit,
  label,
  initialDays,
  format,
}: {
  data: Point[];
  unit: string;
  label: string;
  /** Days shown first (counted back from the last point); the user can still pan and zoom. */
  initialDays?: number;
  format: (value: number) => string;
}) {
  const theme = useTheme();
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [kind, setKind] = useState<Kind>("area");
  const [cum, setCum] = useState(false);
  const [avg, setAvg] = useState(true);
  const [full, setFull] = useState(false);
  const [hover, setHover] = useState<{ time: string; value: number } | null>(null);

  const points = useMemo(() => (cum ? cumulative(data) : data), [data, cum]);
  const last = points[points.length - 1];
  const prev = hover ? points[points.findIndex((p) => p.time === hover.time) - 1] : points[points.length - 2];
  const shown = hover ?? last;
  const change = shown && prev ? shown.value - prev.value : null;
  const pct = change !== null && prev && prev.value !== 0 ? (change / prev.value) * 100 : null;

  const fit = useCallback(() => {
    const chart = chartRef.current;
    if (!chart || !last) return;
    const from = initialDays ? shiftDays(last.time, initialDays) : null;
    if (from && from > points[0].time) {
      chart.timeScale().setVisibleRange({ from: from as Time, to: last.time as Time });
    } else chart.timeScale().fitContent();
  }, [initialDays, last, points]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const c = THEMES[theme];
    const chart = createChart(host, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: c.bg },
        textColor: c.text,
        fontFamily: "inherit",
        fontSize: 12,
        attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: c.grid } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, rightOffset: 2 },
      crosshair: { mode: CrosshairMode.Magnet },
      localization: { priceFormatter: format },
      handleScale: { axisPressedMouseMove: true },
    });
    chartRef.current = chart;

    let main: ISeriesApi<"Area" | "Line" | "Histogram">;
    if (kind === "area") {
      main = chart.addSeries(AreaSeries, {
        lineColor: c.line,
        topColor: `${c.line}55`,
        bottomColor: `${c.line}00`,
        lineWidth: 2,
        priceLineVisible: false,
      });
    } else if (kind === "line") {
      main = chart.addSeries(LineSeries, { color: c.line, lineWidth: 2, priceLineVisible: false });
    } else {
      main = chart.addSeries(HistogramSeries, { color: c.line, priceLineVisible: false });
    }
    main.setData(points as { time: Time; value: number }[]);

    if (avg && points.length > SMA_WINDOW) {
      const line = chart.addSeries(LineSeries, {
        color: c.avg,
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      line.setData(sma(points, SMA_WINDOW) as { time: Time; value: number }[]);
    }

    const onMove = (p: MouseEventParams<Time>) => {
      const v = p.seriesData.get(main) as { value?: number } | undefined;
      setHover(p.time && v?.value !== undefined ? { time: String(p.time), value: v.value } : null);
    };
    chart.subscribeCrosshairMove(onMove);
    fit();

    return () => {
      chart.unsubscribeCrosshairMove(onMove);
      chart.remove();
      chartRef.current = null;
    };
    // fit and format are stable for a given data set; rebuild only on real changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, kind, avg, theme]);

  const pick = (r: Range) => {
    const chart = chartRef.current;
    if (!chart || !last) return;
    const from = rangeStart(last.time, r);
    if (!from) chart.timeScale().fitContent();
    else chart.timeScale().setVisibleRange({ from: (from < points[0].time ? points[0].time : from) as Time, to: last.time as Time });
  };

  const exportPng = () => {
    const canvas = chartRef.current?.takeScreenshot();
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${label.toLowerCase().replace(/\W+/g, "-")}.png`;
    a.click();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    if (full) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);

  if (!points.length) return <p className="text-sm text-slate-500">No emissions recorded in this period.</p>;

  const btn =
    "rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-700 data-[on=true]:bg-slate-900 data-[on=true]:text-white dark:text-slate-300 dark:hover:bg-slate-800 dark:data-[on=true]:bg-slate-100 dark:data-[on=true]:text-slate-900";

  return (
    <div
      className={
        full
          ? "fixed inset-0 z-50 flex h-[100dvh] w-full flex-col gap-3 overflow-hidden px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]"
          : "flex flex-col gap-3"
      }
      style={full ? { background: THEMES[theme].bg } : undefined}
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div aria-live="polite">
          <p className="text-xs text-slate-500">
            {label}
            {shown ? ` · ${fmtDate(shown.time)}` : ""}
          </p>
          <p className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {shown ? format(shown.value) : "-"} <span className="text-sm font-normal text-slate-500">{unit}</span>
          </p>
          {change !== null && (
            <p className={`text-xs tabular-nums ${change > 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
              {change > 0 ? "+" : ""}
              {format(change)} {unit}
              {pct !== null ? ` (${change > 0 ? "+" : ""}${pct.toFixed(1)}%)` : ""} vs previous day
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Chart controls">
          {RANGES.map((r) => (
            <button key={r} type="button" className={btn} onClick={() => pick(r)}>
              {r}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />
          {KINDS.map((k) => (
            <button key={k.id} type="button" className={btn} data-on={kind === k.id} aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
              {k.label}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />
          <button type="button" className={btn} data-on={avg} aria-pressed={avg} onClick={() => setAvg((v) => !v)}>
            {SMA_WINDOW}-day average
          </button>
          <button type="button" className={btn} data-on={cum} aria-pressed={cum} onClick={() => setCum((v) => !v)}>
            Cumulative
          </button>
          <button type="button" className={btn} onClick={fit} aria-label="Reset zoom" title="Reset zoom">
            <RotateCcw className="size-3.5" />
          </button>
          <button type="button" className={btn} onClick={exportPng} aria-label="Download PNG" title="Download PNG">
            <Download className="size-3.5" />
          </button>
          <button type="button" className={btn} onClick={() => setFull((v) => !v)} aria-label={full ? "Exit full screen" : "Full screen"} title={full ? "Exit full screen" : "Full screen"}>
            {full ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </button>
        </div>
      </div>

      <div
        ref={hostRef}
        role="img"
        aria-label={`${label}: ${points.length} daily values from ${fmtDate(points[0].time)} to ${fmtDate(last.time)}, latest ${format(last.value)} ${unit}. Full values are in the table below the chart.`}
        className={full ? "min-h-0 min-w-0 flex-1 overflow-hidden" : "h-80 w-full min-w-0 touch-pan-y"}
      />

      <details className="text-xs text-slate-600 dark:text-slate-400">
        <summary className="cursor-pointer">Show values as a table</summary>
        <div className={`mt-2 overflow-auto ${full ? "max-h-32" : "max-h-56"}`}>
          <table className="w-full text-left tabular-nums">
            <thead>
              <tr>
                <th className="py-1 pr-4 font-medium">Date</th>
                <th className="py-1 font-medium">{unit}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.time}>
                  <td className="pr-4">{fmtDate(p.time)}</td>
                  <td>{format(p.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function shiftDays(last: string, days: number): string {
  const d = new Date(`${last}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
