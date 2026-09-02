import { describe, it, expect } from "vitest";
import { getLimits, usagePercent, PLAN_PRICES, PLAN_LABELS } from "@/lib/billing/limits";

describe("getLimits", () => {
  it("returns trial limits for unknown plan", () => {
    const limits = getLimits("unknown");
    expect(limits.reportsPerMonth).toBe(2);
    expect(limits.members).toBe(3);
  });

  it("returns trial limits", () => {
    const l = getLimits("trial");
    expect(l.fieldSubmissionsPerMonth).toBe(50);
    expect(l.importsPerMonth).toBe(5);
  });

  it("returns starter limits", () => {
    const l = getLimits("starter");
    expect(l.fieldSubmissionsPerMonth).toBe(500);
    expect(l.members).toBe(10);
  });

  it("returns growth limits", () => {
    const l = getLimits("growth");
    expect(l.members).toBe(50);
    expect(l.apiRequestsPerMonth).toBe(100_000);
  });

  it("enterprise has Infinity limits", () => {
    const l = getLimits("enterprise");
    expect(l.reportsPerMonth).toBe(Infinity);
    expect(l.importsPerMonth).toBe(Infinity);
  });
});

describe("usagePercent", () => {
  it("returns 0 for Infinity limit", () => {
    expect(usagePercent(1000, Infinity)).toBe(0);
  });

  it("returns 0 for limit of 0", () => {
    expect(usagePercent(5, 0)).toBe(0);
  });

  it("calculates percent correctly", () => {
    expect(usagePercent(25, 100)).toBe(25);
    expect(usagePercent(50, 100)).toBe(50);
  });

  it("caps at 100%", () => {
    expect(usagePercent(200, 100)).toBe(100);
  });

  it("rounds to nearest integer", () => {
    expect(usagePercent(1, 3)).toBe(33);
  });
});

describe("PLAN_PRICES", () => {
  it("trial is free", () => {
    expect(PLAN_PRICES.trial.monthly).toBe(0);
    expect(PLAN_PRICES.trial.annual).toBe(0);
  });

  it("growth has annual discount vs monthly", () => {
    expect(PLAN_PRICES.growth.annual).toBeLessThan(PLAN_PRICES.growth.monthly);
  });

  it("enterprise is custom (0)", () => {
    expect(PLAN_PRICES.enterprise.monthly).toBe(0);
  });
});

describe("PLAN_LABELS", () => {
  it("has labels for all plans", () => {
    expect(PLAN_LABELS.trial).toBe("Trial");
    expect(PLAN_LABELS.starter).toBe("Starter");
    expect(PLAN_LABELS.growth).toBe("Growth");
    expect(PLAN_LABELS.enterprise).toBe("Enterprise");
  });
});
