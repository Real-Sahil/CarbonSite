/**
 * Calendar rules for subcontractor requests. A due date is a calendar day (a
 * `@db.Date` column, stored at UTC midnight), so every comparison is made on UTC
 * days. A request is overdue from the day after its due date, never during it.
 */

const DAY = 24 * 60 * 60 * 1000;

/** A reminder goes out once the due date is this many days away or nearer. */
export const REMINDER_NOTICE_DAYS = 7;
/** Requests overdue for longer than this are left alone rather than chased every day. */
export const REMINDER_LOOKBACK_DAYS = 60;
/** At most this many reminders per request, after the first link. */
export const MAX_REMINDERS = 3;
/** Days between reminders on the same request. */
export const REMINDER_GAP_DAYS = 7;

export function startOfUtcDay(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Whole UTC days from today to the due day: 0 on the due day, negative once it has passed. */
export function daysUntilDue(dueDate: Date, now: Date) {
  return Math.round((dueDate.getTime() - startOfUtcDay(now).getTime()) / DAY);
}

export function isPastDue(dueDate: Date, now: Date) {
  return daysUntilDue(dueDate, now) < 0;
}

/**
 * Earliest moment a reminder may have been sent and still leave the gap intact.
 * The monitor runs at a fixed time each day, so the gap is counted in whole UTC
 * days: a reminder sent on day D allows the next on day D + REMINDER_GAP_DAYS.
 */
export function reminderGapCutoff(now: Date) {
  return new Date(startOfUtcDay(now).getTime() - (REMINDER_GAP_DAYS - 1) * DAY);
}

/** The due-date window a reminder run looks at: from the lookback to the notice period. */
export function reminderDateWindow(now: Date) {
  const today = startOfUtcDay(now);
  return {
    from: new Date(today.getTime() - REMINDER_LOOKBACK_DAYS * DAY),
    to: new Date(today.getTime() + REMINDER_NOTICE_DAYS * DAY),
  };
}

/**
 * Whether a request should get a reminder today. The database query narrows
 * the rows the same way; this is the rule the tests pin down.
 *
 * The gap counts from the last contact: the link itself until the first reminder,
 * then the last reminder. So a link sent three days before the due date is not
 * chased the next morning; it waits a week, like every later reminder.
 */
export function reminderDue(
  row: { dueDate: Date; reminderCount: number; linkSentAt: Date | null; lastReminderAt: Date | null },
  now: Date,
) {
  const days = daysUntilDue(row.dueDate, now);
  if (days > REMINDER_NOTICE_DAYS || days < -REMINDER_LOOKBACK_DAYS) return false;
  if (row.reminderCount >= MAX_REMINDERS) return false;
  const lastContact = row.lastReminderAt ?? row.linkSentAt;
  return lastContact !== null && lastContact < reminderGapCutoff(now);
}
