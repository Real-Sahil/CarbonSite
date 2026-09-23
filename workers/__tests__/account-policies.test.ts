import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/jobs/dispatch", () => ({ dispatchNotification: vi.fn() }));

import { planSupplierPolicies } from "../account-policies";

const now = new Date("2026-09-23T03:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
const expiry = { passwordRotationDays: null, accountExpiryDays: 90 };
const rotation = { passwordRotationDays: 60, accountExpiryDays: null };

describe("inactivity expiry", () => {
  it("never cuts off someone invited recently who has not signed in yet", () => {
    expect(planSupplierPolicies({ userId: "u", joinedAt: daysAgo(1), lastSignInAt: null, passwordChangedAt: null }, expiry, now)).toEqual([]);
  });

  it("counts a never-signed-in supplier from the day they joined", () => {
    const [a] = planSupplierPolicies({ userId: "u", joinedAt: daysAgo(90), lastSignInAt: null, passwordChangedAt: null }, expiry, now);
    expect(a).toMatchObject({ kind: "terminate", inactiveDays: 90 });
  });

  it("warns the supplier 14 and 3 days ahead, and only on those days", () => {
    const plan = (d: number) => planSupplierPolicies({ userId: "u", joinedAt: daysAgo(400), lastSignInAt: daysAgo(d), passwordChangedAt: null }, expiry, now);
    expect(plan(76)).toEqual([{ kind: "access_expiring", userId: "u", daysRemaining: 14 }]);
    expect(plan(87)).toEqual([{ kind: "access_expiring", userId: "u", daysRemaining: 3 }]);
    expect(plan(80)).toEqual([]);
    expect(plan(10)).toEqual([]);
  });

  it("a recent sign-in keeps access", () => {
    expect(planSupplierPolicies({ userId: "u", joinedAt: daysAgo(400), lastSignInAt: daysAgo(89), passwordChangedAt: null }, expiry, now)).toEqual([]);
  });
});

describe("password rotation", () => {
  const plan = (age: number) =>
    planSupplierPolicies({ userId: "u", joinedAt: daysAgo(400), lastSignInAt: daysAgo(1), passwordChangedAt: daysAgo(age) }, rotation, now);

  it("reminds 7 days and 1 day before the change is due", () => {
    expect(plan(53)).toEqual([{ kind: "password_expiring", userId: "u", daysRemaining: 7 }]);
    expect(plan(59)).toEqual([{ kind: "password_expiring", userId: "u", daysRemaining: 1 }]);
    expect(plan(55)).toEqual([]);
  });

  it("says it is overdue on the due day and weekly after, not daily", () => {
    expect(plan(60)).toEqual([{ kind: "password_overdue", userId: "u", daysOverdue: 0 }]);
    expect(plan(67)).toEqual([{ kind: "password_overdue", userId: "u", daysOverdue: 7 }]);
    expect(plan(62)).toEqual([]);
  });

  it("does nothing when the org has no policy", () => {
    expect(planSupplierPolicies({ userId: "u", joinedAt: daysAgo(999), lastSignInAt: null, passwordChangedAt: daysAgo(999) }, { passwordRotationDays: null, accountExpiryDays: null }, now)).toEqual([]);
  });
});
