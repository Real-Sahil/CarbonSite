/**
 * Monthly emissions series from dashboard slices (one row per scope, category, site... and month).
 * Reporting periods can be a year long, which leaves a forecast two points; slices keep the month.
 * Months with no records inside the range count as zero, so the yearly position stays right for
 * the seasonal models. A series with fewer than MIN_DATED_MONTHS months of records (quarterly
 * bills, undated records) is too sparse to forecast monthly, and the caller keeps period totals.
 */

export const MIN_DATED_MONTHS = 12;

export interface SliceMonthRow {
  month: Date | null;
  totalCo2e: number;
}

export function monthlySeriesFromSlices(rows: SliceMonthRow[]): Array<{ date: string; value: number }> | null {
  const byMonth = new Map<string, number>();
  for (const r of rows) {
    if (!r.month) continue;
    const key = r.month.toISOString().slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + r.totalCo2e);
  }
  const withData = [...byMonth.entries()].filter(([, v]) => v > 0);
  if (withData.length < MIN_DATED_MONTHS) return null;

  const keys = [...byMonth.keys()].sort();
  const [y0, m0] = keys[0].split("-").map(Number);
  const [y1, m1] = keys[keys.length - 1].split("-").map(Number);
  const out: Array<{ date: string; value: number }> = [];
  for (let y = y0, m = m0; y < y1 || (y === y1 && m <= m1); m === 12 ? (y++, (m = 1)) : m++) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    out.push({ date: `${key}-01`, value: Math.max(0, byMonth.get(key) ?? 0) });
  }
  return out;
}
