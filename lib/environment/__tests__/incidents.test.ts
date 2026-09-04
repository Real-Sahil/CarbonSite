import { describe, it, expect } from "vitest";
import {
  defaultRegulatorNotifiable,
  notificationTargetHours,
  assessNotificationTimeliness,
  isActionOpen,
  canCloseIncident,
  deriveActionStatus,
  summariseIncidentRegister,
  nextIncidentReference,
} from "../incidents";

const NOW = new Date("2026-06-15T12:00:00Z");

describe("defaultRegulatorNotifiable", () => {
  it("defaults to notifiable for major and severe incidents", () => {
    expect(defaultRegulatorNotifiable("spill", "major")).toBe(true);
    expect(defaultRegulatorNotifiable("complaint", "severe")).toBe(true);
  });

  it("treats a moderate unauthorised release as notifiable", () => {
    // The duty attaches to the breach itself, not to the resulting harm.
    expect(defaultRegulatorNotifiable("unauthorised_release", "moderate")).toBe(true);
    expect(defaultRegulatorNotifiable("exceedance", "moderate")).toBe(true);
    expect(defaultRegulatorNotifiable("ecological_damage", "moderate")).toBe(true);
  });

  it("leaves an ordinary moderate incident to the operator's judgement", () => {
    expect(defaultRegulatorNotifiable("complaint", "moderate")).toBe(false);
    expect(defaultRegulatorNotifiable("near_miss", "minor")).toBe(false);
  });
});

describe("notificationTargetHours", () => {
  it("gives a tighter window for severe than major", () => {
    expect(notificationTargetHours("severe")).toBe(24);
    expect(notificationTargetHours("major")).toBe(72);
  });

  it("has no window for lower severities", () => {
    expect(notificationTargetHours("moderate")).toBeNull();
    expect(notificationTargetHours("negligible")).toBeNull();
  });
});

describe("assessNotificationTimeliness", () => {
  it("runs the clock from discovery, not occurrence", () => {
    // Spilled two weeks ago, found four hours ago: well inside the window.
    const result = assessNotificationTimeliness({
      severity: "severe",
      regulatorNotifiable: true,
      occurredAt: new Date("2026-06-01T12:00:00Z"),
      discoveredAt: new Date("2026-06-15T08:00:00Z"),
      regulatorNotifiedAt: null,
      now: NOW,
    });
    expect(result.hoursElapsed).toBeCloseTo(4, 5);
    expect(result.isOverdue).toBe(false);
  });

  it("falls back to occurrence when discovery was not recorded", () => {
    const result = assessNotificationTimeliness({
      severity: "severe",
      regulatorNotifiable: true,
      occurredAt: new Date("2026-06-13T12:00:00Z"),
      discoveredAt: null,
      regulatorNotifiedAt: null,
      now: NOW,
    });
    expect(result.hoursElapsed).toBeCloseTo(48, 5);
    expect(result.isOverdue).toBe(true);
  });

  it("stops the clock once the regulator has been told", () => {
    const result = assessNotificationTimeliness({
      severity: "severe",
      regulatorNotifiable: true,
      occurredAt: new Date("2026-06-01T00:00:00Z"),
      discoveredAt: new Date("2026-06-01T00:00:00Z"),
      regulatorNotifiedAt: new Date("2026-06-01T06:00:00Z"),
      now: NOW,
    });
    expect(result.isOverdue).toBe(false);
    expect(result.hoursElapsed).toBeCloseTo(6, 5);
  });

  it("is never overdue when there is no duty to notify", () => {
    const result = assessNotificationTimeliness({
      severity: "minor",
      regulatorNotifiable: false,
      occurredAt: new Date("2025-01-01T00:00:00Z"),
      discoveredAt: null,
      regulatorNotifiedAt: null,
      now: NOW,
    });
    expect(result.isOverdue).toBe(false);
    expect(result.targetHours).toBeNull();
  });
});

describe("canCloseIncident", () => {
  const base = {
    rootCause: "Tank bund seal perished after eight years in service.",
    regulatorNotifiable: false,
    regulatorNotifiedAt: null,
    actions: [] as Array<{ status: "open" | "verified" | "cancelled" | "in_progress" }>,
  };

  it("allows closure when everything is resolved", () => {
    expect(canCloseIncident(base).canClose).toBe(true);
  });

  it("blocks closure while actions remain open", () => {
    const check = canCloseIncident({ ...base, actions: [{ status: "in_progress" }] });
    expect(check.canClose).toBe(false);
    expect(check.reasons.join(" ")).toContain("still open");
  });

  it("treats verified and cancelled actions as resolved", () => {
    const check = canCloseIncident({
      ...base,
      actions: [{ status: "verified" }, { status: "cancelled" }],
    });
    expect(check.canClose).toBe(true);
  });

  it("blocks closure without a recorded root cause", () => {
    expect(canCloseIncident({ ...base, rootCause: null }).canClose).toBe(false);
    expect(canCloseIncident({ ...base, rootCause: "dunno" }).canClose).toBe(false);
  });

  it("blocks closure of a notifiable incident the regulator was never told about", () => {
    const check = canCloseIncident({ ...base, regulatorNotifiable: true });
    expect(check.canClose).toBe(false);
    expect(check.reasons.join(" ")).toContain("regulator");
  });

  it("lists every blocker at once rather than one at a time", () => {
    const check = canCloseIncident({
      rootCause: null,
      regulatorNotifiable: true,
      regulatorNotifiedAt: null,
      actions: [{ status: "open" }],
    });
    expect(check.reasons).toHaveLength(3);
  });
});

describe("deriveActionStatus", () => {
  it("marks an open action overdue once its due date passes", () => {
    expect(deriveActionStatus({ status: "open", dueOn: new Date("2026-06-01") }, NOW)).toBe(
      "overdue",
    );
  });

  it("leaves a verified action alone even if it was late", () => {
    expect(deriveActionStatus({ status: "verified", dueOn: new Date("2026-06-01") }, NOW)).toBe(
      "verified",
    );
  });

  it("leaves a cancelled action alone", () => {
    expect(deriveActionStatus({ status: "cancelled", dueOn: new Date("2026-06-01") }, NOW)).toBe(
      "cancelled",
    );
  });

  it("leaves an action with no due date as it is", () => {
    expect(deriveActionStatus({ status: "open", dueOn: null }, NOW)).toBe("open");
  });
});

describe("isActionOpen", () => {
  it("counts awaiting verification as still open", () => {
    // The work is done but nobody has confirmed it worked, so the incident
    // is not finished.
    expect(isActionOpen("awaiting_verification")).toBe(true);
    expect(isActionOpen("overdue")).toBe(true);
    expect(isActionOpen("verified")).toBe(false);
    expect(isActionOpen("cancelled")).toBe(false);
  });
});

describe("summariseIncidentRegister", () => {
  it("aggregates severity, open state, notifications and actions", () => {
    const summary = summariseIncidentRegister(
      [
        {
          severity: "severe",
          status: "investigating",
          regulatorNotifiable: true,
          occurredAt: new Date("2026-06-01T00:00:00Z"),
          discoveredAt: null,
          regulatorNotifiedAt: null,
          actions: [
            { status: "open", dueOn: new Date("2026-06-01") },
            { status: "verified", dueOn: null },
          ],
        },
        {
          severity: "minor",
          status: "closed",
          regulatorNotifiable: false,
          occurredAt: new Date("2026-05-01T00:00:00Z"),
          discoveredAt: null,
          regulatorNotifiedAt: null,
          actions: [],
        },
      ],
      NOW,
    );

    expect(summary.total).toBe(2);
    expect(summary.open).toBe(1);
    expect(summary.closed).toBe(1);
    expect(summary.bySeverity.severe).toBe(1);
    expect(summary.bySeverity.minor).toBe(1);
    expect(summary.overdueNotifications).toBe(1);
    expect(summary.openActions).toBe(1);
    expect(summary.overdueActions).toBe(1);
  });
});

describe("nextIncidentReference", () => {
  it("starts at one for a fresh year", () => {
    expect(nextIncidentReference([], NOW)).toBe("INC-2026-0001");
  });

  it("continues from the highest existing number", () => {
    expect(nextIncidentReference(["INC-2026-0001", "INC-2026-0007"], NOW)).toBe("INC-2026-0008");
  });

  it("ignores references from other years", () => {
    expect(nextIncidentReference(["INC-2025-0099"], NOW)).toBe("INC-2026-0001");
  });

  it("is not fooled by gaps or out-of-order input", () => {
    expect(nextIncidentReference(["INC-2026-0009", "INC-2026-0002"], NOW)).toBe("INC-2026-0010");
  });

  it("ignores malformed references rather than throwing", () => {
    expect(nextIncidentReference(["INC-2026-abc", "nonsense", "INC-2026-0003"], NOW)).toBe(
      "INC-2026-0004",
    );
  });
});
