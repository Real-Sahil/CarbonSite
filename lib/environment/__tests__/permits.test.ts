import { describe, it, expect } from "vitest";
import {
  daysUntil,
  permitUrgency,
  isOperatingOnExpiredPermit,
  summarisePermitRegister,
  permitSortRank,
  type PermitLike,
} from "../permits";

const NOW = new Date("2026-06-15T12:00:00Z");

function permit(over: Partial<PermitLike> = {}): PermitLike {
  return { status: "active", expiresOn: null, renewalNoticeDays: 90, ...over };
}

describe("daysUntil", () => {
  it("counts whole days forward", () => {
    expect(daysUntil(new Date("2026-06-25T00:00:00Z"), NOW)).toBe(10);
  });

  it("returns negative once the date has passed", () => {
    expect(daysUntil(new Date("2026-06-05T00:00:00Z"), NOW)).toBe(-10);
  });

  it("returns zero on the day itself regardless of time of day", () => {
    expect(daysUntil(new Date("2026-06-15T23:59:00Z"), NOW)).toBe(0);
  });
});

describe("permitUrgency", () => {
  it("treats a permit with no expiry as current", () => {
    expect(permitUrgency(permit({ expiresOn: null }), NOW)).toBe("current");
  });

  it("flags a permit past its expiry", () => {
    expect(permitUrgency(permit({ expiresOn: new Date("2026-06-01") }), NOW)).toBe("expired");
  });

  it("flags renewal due once inside the permit's own lead time", () => {
    // 30 days out with a 90 day lead time is inside the window.
    expect(permitUrgency(permit({ expiresOn: new Date("2026-07-15") }), NOW)).toBe("renewal_due");
  });

  it("respects a longer lead time for slow regimes", () => {
    // 200 days out is comfortable at 90 days notice but urgent at 365.
    const far = new Date("2027-01-01");
    expect(permitUrgency(permit({ expiresOn: far, renewalNoticeDays: 90 }), NOW)).toBe("current");
    expect(permitUrgency(permit({ expiresOn: far, renewalNoticeDays: 365 }), NOW)).toBe(
      "renewal_due",
    );
  });

  it("gives a heads-up band beyond the lead time", () => {
    // 120 days out, 90 day lead time: past renewal_due but inside the 60 day
    // heads-up band that follows it.
    expect(permitUrgency(permit({ expiresOn: new Date("2026-10-13") }), NOW)).toBe(
      "expiring_soon",
    );
  });

  it("ignores permits that are not live", () => {
    for (const status of ["expired", "revoked", "surrendered", "suspended", "draft"] as const) {
      expect(permitUrgency(permit({ status, expiresOn: new Date("2026-07-01") }), NOW)).toBe(
        "not_active",
      );
    }
  });

  it("still assesses a permit that is only applied for", () => {
    expect(permitUrgency(permit({ status: "applied", expiresOn: new Date("2026-07-01") }), NOW)).toBe(
      "renewal_due",
    );
  });
});

describe("isOperatingOnExpiredPermit", () => {
  it("is true only when an active permit has passed its expiry", () => {
    expect(
      isOperatingOnExpiredPermit(permit({ status: "active", expiresOn: new Date("2026-06-01") }), NOW),
    ).toBe(true);
  });

  it("is false when the permit was properly surrendered", () => {
    expect(
      isOperatingOnExpiredPermit(
        permit({ status: "surrendered", expiresOn: new Date("2026-06-01") }),
        NOW,
      ),
    ).toBe(false);
  });

  it("is false for a permit with no expiry", () => {
    expect(isOperatingOnExpiredPermit(permit({ expiresOn: null }), NOW)).toBe(false);
  });
});

describe("summarisePermitRegister", () => {
  it("counts lifecycle states and condition compliance together", () => {
    const summary = summarisePermitRegister(
      [
        {
          ...permit({ status: "active", expiresOn: new Date("2026-06-01") }),
          conditions: [
            { complianceStatus: "breach", nextDueOn: null },
            { complianceStatus: "compliant", nextDueOn: new Date("2026-05-01") },
          ],
        },
        {
          ...permit({ status: "active", expiresOn: new Date("2026-07-15") }),
          conditions: [{ complianceStatus: "at_risk", nextDueOn: new Date("2026-12-01") }],
        },
        {
          ...permit({ status: "expired", expiresOn: new Date("2025-01-01") }),
          conditions: [],
        },
      ],
      NOW,
    );

    expect(summary.total).toBe(3);
    expect(summary.active).toBe(2);
    expect(summary.expired).toBe(1);
    expect(summary.operatingOnExpired).toBe(1);
    expect(summary.renewalDue).toBe(1);
    expect(summary.conditionsInBreach).toBe(1);
    expect(summary.conditionsAtRisk).toBe(1);
    // The compliant condition's assessment was due six weeks ago.
    expect(summary.conditionsOverdueAssessment).toBe(1);
  });

  it("returns zeroes for an empty register", () => {
    const summary = summarisePermitRegister([], NOW);
    expect(summary.total).toBe(0);
    expect(summary.operatingOnExpired).toBe(0);
  });
});

describe("permitSortRank", () => {
  it("puts expired first and inactive last", () => {
    expect(permitSortRank("expired")).toBeLessThan(permitSortRank("renewal_due"));
    expect(permitSortRank("renewal_due")).toBeLessThan(permitSortRank("expiring_soon"));
    expect(permitSortRank("expiring_soon")).toBeLessThan(permitSortRank("current"));
    expect(permitSortRank("current")).toBeLessThan(permitSortRank("not_active"));
  });
});
