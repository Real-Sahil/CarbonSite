export type Point = { time: string; value: number };

/** Simple moving average over `window` points; the first points use what exists so far. */
export function sma(points: Point[], window: number): Point[] {
  const out: Point[] = [];
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    sum += points[i].value;
    if (i >= window) sum -= points[i - window].value;
    out.push({ time: points[i].time, value: sum / Math.min(i + 1, window) });
  }
  return out;
}

export function cumulative(points: Point[]): Point[] {
  let total = 0;
  return points.map((p) => ({ time: p.time, value: (total += p.value) }));
}

/** First date (YYYY-MM-DD) a range button shows, counted back from the last point. */
export function rangeStart(last: string, range: "1M" | "3M" | "6M" | "YTD" | "All"): string | null {
  if (range === "All") return null;
  const d = new Date(`${last}T00:00:00Z`);
  if (range === "YTD") return `${d.getUTCFullYear()}-01-01`;
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - { "1M": 1, "3M": 3, "6M": 6 }[range]);
  // Clamp so 31 May minus 3 months is 28 Feb, not 3 Mar.
  d.setUTCDate(Math.min(day, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()));
  return d.toISOString().slice(0, 10);
}
