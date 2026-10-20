// The period a headline change is measured against. The next period by start
// date is not always comparable: a nine-month year to date against a full prior
// year reads as a large fall that is only the missing months.

export type PeriodSpan = { id: string; startDate: Date; endDate: Date };

const DAY = 86_400_000;
const days = (p: PeriodSpan) => Math.round((p.endDate.getTime() - p.startDate.getTime()) / DAY) + 1;

/** Two periods compare when their lengths differ by no more than 10% (a leap day or a 28 to 31 day month passes). */
export function spansComparable(a: PeriodSpan, b: PeriodSpan): boolean {
  const x = days(a);
  const y = days(b);
  return Math.abs(x - y) <= Math.max(x, y) * 0.1;
}

/**
 * The newest period before `current` with a comparable length, or null when there is none, so the page
 * shows no change rather than a misleading one. `periods` is newest first.
 */
export function priorComparablePeriod<T extends PeriodSpan>(periods: T[], current: T | null): T | null {
  if (!current) return null;
  const at = periods.findIndex((p) => p.id === current.id);
  if (at < 0) return null;
  return periods.slice(at + 1).find((p) => spansComparable(p, current)) ?? null;
}
