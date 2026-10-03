// The financial year an organisation reports in. Periods stay free-form; this
// only suggests the dates and label so a company whose year runs April to March
// does not have to work them out. A calendar-year company (start month 1) gets
// "FY2026"; a company whose year spans two calendar years gets "FY2026/27",
// named for the year it starts in.

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

export function isStartMonth(m: unknown): m is number {
  return Number.isInteger(m) && (m as number) >= 1 && (m as number) <= 12;
}

export type FiscalYear = { label: string; startDate: string; endDate: string };

/** The financial year containing `date` (UTC), for a year starting on the first of `startMonth`. */
export function fiscalYearOf(date: Date, startMonth: number): FiscalYear {
  const m = isStartMonth(startMonth) ? startMonth : 1;
  const month = date.getUTCMonth() + 1;
  const startYear = month >= m ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
  const endYear = m === 1 ? startYear : startYear + 1;
  const endMonth = m === 1 ? 12 : m - 1;
  const lastDay = new Date(Date.UTC(endYear, endMonth, 0)).getUTCDate();
  return {
    label: m === 1 ? `FY${startYear}` : `FY${startYear}/${pad(endYear % 100)}`,
    startDate: iso(startYear, m, 1),
    endDate: iso(endYear, endMonth, lastDay),
  };
}
