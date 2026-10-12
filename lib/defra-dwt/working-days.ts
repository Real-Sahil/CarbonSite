// Working-day arithmetic on the UK calendar. A day is a "YYYY-MM-DD" string read in Europe/London, so a receipt at
// 00:30 BST is the day it looks like on the yard clock, not the UTC day. Bank holidays come from bank-holidays.ts.

import { BANK_HOLIDAY_YEARS, BANK_HOLIDAYS, type Nation } from "./bank-holidays";

const UK_CLOCK = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Throws on anything that is not a real calendar day written YYYY-MM-DD. */
export function assertDay(day: string): void {
  const [y, m, d] = DAY.test(day) ? day.split("-").map(Number) : [0, 0, 0];
  const real = new Date(Date.UTC(y, m - 1, d));
  if (!DAY.test(day) || real.getUTCFullYear() !== y || real.getUTCMonth() !== m - 1 || real.getUTCDate() !== d) {
    throw new RangeError(`Not a calendar day (YYYY-MM-DD): ${day}`);
  }
}

/** The UK calendar day an instant falls on, as YYYY-MM-DD. */
export function ukDay(instant: Date): string {
  const p = wallClock(instant);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Day of the week for a YYYY-MM-DD day: 0 is Sunday, 6 is Saturday. */
function weekdayOf(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** The day after (or before, with a negative count) a YYYY-MM-DD day. */
export function addDays(day: string, count: number): string {
  assertDay(day);
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + count)).toISOString().slice(0, 10);
}

/**
 * Weekends and that nation's bank holidays are not working days. A year outside BANK_HOLIDAY_YEARS throws rather than
 * being treated as a working day: a guessed deadline is worse than none.
 */
export function isWorkingDay(day: string, nation: Nation): boolean {
  assertDay(day);
  const year = Number(day.slice(0, 4));
  if (year < BANK_HOLIDAY_YEARS.first || year > BANK_HOLIDAY_YEARS.last) {
    throw new RangeError(`Bank holidays are loaded for ${BANK_HOLIDAY_YEARS.first} to ${BANK_HOLIDAY_YEARS.last}, not ${year}`);
  }
  const weekday = weekdayOf(day);
  return weekday !== 0 && weekday !== 6 && !BANK_HOLIDAYS[nation].includes(day as never);
}

/** The n-th working day after a day (n = 1 is the next working day). The start day itself is not counted. */
export function nthWorkingDayAfter(day: string, n: number, nation: Nation): string {
  let current = day;
  for (let left = n; left > 0; ) {
    current = addDays(current, 1);
    if (isWorkingDay(current, nation)) left--;
  }
  return current;
}

/** The instant 23:59:59.999 UK time on a day: BST (UTC+1) in summer, GMT in winter. */
export function endOfUkDay(day: string): Date {
  assertDay(day);
  const [y, m, d] = day.split("-").map(Number);
  const wallAsUtc = Date.UTC(y, m - 1, d, 23, 59, 59, 999);
  // The offset is read at the instant it corrects, so one more pass settles it when the clocks change that night.
  const first = wallAsUtc - londonOffsetMs(new Date(wallAsUtc));
  return new Date(wallAsUtc - londonOffsetMs(new Date(first)));
}

// Offset of London from UTC at an instant, in milliseconds (positive east of Greenwich).
function londonOffsetMs(instant: Date): number {
  const p = wallClock(instant);
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wallAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

function wallClock(instant: Date) {
  const parts = Object.fromEntries(UK_CLOCK.formatToParts(instant).map((x) => [x.type, x.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");
