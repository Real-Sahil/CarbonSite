import { describe, expect, it } from "vitest";
import { reminderStage, riddorDeadline } from "../reminders";

const at = (s: string) => new Date(s);

describe("riddorDeadline", () => {
  it("gives an over-7-day injury 15 days from the incident", () => {
    expect(riddorDeadline({ occurredAt: at("2026-09-01T14:30:00Z"), incidentType: "lost_time_injury", lostTimeDays: 9 }).toISOString().slice(0, 10)).toBe("2026-09-16");
  });

  it("gives specified injuries, dangerous occurrences and deaths 10 days", () => {
    for (const incidentType of ["riddor_reportable", "dangerous_occurrence", "fatality", "occupational_disease"]) {
      expect(riddorDeadline({ occurredAt: at("2026-09-01T08:00:00Z"), incidentType, lostTimeDays: 0 }).toISOString().slice(0, 10)).toBe("2026-09-11");
    }
  });

  it("uses the shorter deadline when lost time is 7 days or fewer", () => {
    expect(riddorDeadline({ occurredAt: at("2026-09-01T08:00:00Z"), incidentType: "lost_time_injury", lostTimeDays: 7 }).toISOString().slice(0, 10)).toBe("2026-09-11");
  });

  it("is due soon from the day it is recorded and overdue after the deadline", () => {
    const due = riddorDeadline({ occurredAt: at("2026-09-01T08:00:00Z"), incidentType: "dangerous_occurrence", lostTimeDays: 0 });
    expect(reminderStage(due, at("2026-09-01T00:00:00Z"))).toBe("due_soon");
    expect(reminderStage(due, at("2026-09-12T00:00:00Z"))).toBe("overdue");
  });
});
