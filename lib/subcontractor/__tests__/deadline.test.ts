import { describe, expect, it } from "vitest";
import {
  MAX_REMINDERS,
  REMINDER_GAP_DAYS,
  REMINDER_LOOKBACK_DAYS,
  REMINDER_NOTICE_DAYS,
  daysUntilDue,
  isPastDue,
  reminderDateWindow,
  reminderDue,
  reminderGapCutoff,
} from "@/lib/subcontractor/deadline";

// Due dates are calendar days stored at UTC midnight. Every rule here counts UTC days.
const NOW = new Date("2026-11-20T09:00:00Z");
const DUE = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("daysUntilDue", () => {
  it("counts whole UTC days, zero on the due day", () => {
    expect(daysUntilDue(DUE("2026-11-25"), NOW)).toBe(5);
    expect(daysUntilDue(DUE("2026-11-20"), NOW)).toBe(0);
    expect(daysUntilDue(DUE("2026-11-19"), NOW)).toBe(-1);
  });

  it("uses the UTC day, so late evening in the UK is still the same day", () => {
    const lateUtc = new Date("2026-11-20T23:30:00Z");
    expect(daysUntilDue(DUE("2026-11-20"), lateUtc)).toBe(0);
    expect(daysUntilDue(DUE("2026-11-21"), lateUtc)).toBe(1);
  });

  it("makes a request overdue from the day after its due date, never during it", () => {
    expect(isPastDue(DUE("2026-11-20"), NOW)).toBe(false);
    expect(isPastDue(DUE("2026-11-19"), NOW)).toBe(true);
  });
});

describe("reminder window", () => {
  it("runs from the lookback to the notice period, counted from today's UTC midnight", () => {
    const { from, to } = reminderDateWindow(NOW);
    // 60 days before 20 November is 21 September; 7 days after is 27 November.
    expect(from).toEqual(DUE("2026-09-21"));
    expect(to).toEqual(DUE("2026-11-27"));
    expect(REMINDER_LOOKBACK_DAYS).toBe(60);
    expect(REMINDER_NOTICE_DAYS).toBe(7);
  });

  it("moves the gap cutoff back so a reminder sent on day D allows the next on D + the gap", () => {
    expect(REMINDER_GAP_DAYS).toBe(7);
    // Sent on 13 November: 13 + 7 = 20, so it is due again today.
    expect(reminderGapCutoff(new Date("2026-11-20T09:00:00Z"))).toEqual(DUE("2026-11-14"));
  });
});

describe("reminderDue", () => {
  const base = {
    dueDate: DUE("2026-11-25"),
    reminderCount: 0,
    linkSentAt: new Date("2026-11-01T10:00:00Z"),
    lastReminderAt: null,
  };

  it("is due when the link is older than the gap and the due date is within the notice period", () => {
    expect(reminderDue({ ...base, dueDate: DUE("2026-11-27") }, NOW)).toBe(true);
  });

  it("is not due more than the notice period before the due date", () => {
    expect(reminderDue({ ...base, dueDate: DUE("2026-11-28") }, NOW)).toBe(false);
  });

  it("is not due more than the lookback after the due date", () => {
    expect(reminderDue({ ...base, dueDate: DUE("2026-09-20") }, NOW)).toBe(false);
  });

  it("does not chase a link sent a day or two before, waiting the full gap like later reminders", () => {
    const freshLink = { ...base, dueDate: DUE("2026-11-21"), linkSentAt: new Date("2026-11-18T10:00:00Z") };
    expect(reminderDue(freshLink, NOW)).toBe(false);
  });

  it("counts the gap from the last reminder once one has gone", () => {
    expect(reminderDue({ ...base, lastReminderAt: new Date("2026-11-17T10:00:00Z") }, NOW)).toBe(false);
    expect(reminderDue({ ...base, lastReminderAt: new Date("2026-11-13T09:00:00Z") }, NOW)).toBe(true);
  });

  it("is exactly one gap: six days after the last contact is too soon, seven is due", () => {
    expect(reminderDue({ ...base, lastReminderAt: new Date("2026-11-14T09:00:00Z") }, NOW)).toBe(false);
    expect(reminderDue({ ...base, lastReminderAt: new Date("2026-11-13T09:00:00Z") }, NOW)).toBe(true);
  });

  it("stops at the reminder cap", () => {
    expect(reminderDue({ ...base, reminderCount: MAX_REMINDERS - 1 }, NOW)).toBe(true);
    expect(reminderDue({ ...base, reminderCount: MAX_REMINDERS }, NOW)).toBe(false);
  });

  it("is never due with no link and no reminder to count from", () => {
    expect(reminderDue({ ...base, linkSentAt: null }, NOW)).toBe(false);
  });
});
