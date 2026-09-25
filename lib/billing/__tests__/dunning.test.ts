import { describe, expect, it } from "vitest";
import { paymentState } from "../dunning";

const d = (s: string) => new Date(`${s}T12:00:00Z`);

describe("payment state after a failed renewal", () => {
  it("is fine with no failure", () => {
    expect(paymentState(null).state).toBe("ok");
    expect(paymentState({ status: "active", paymentFailedAt: null }).state).toBe("ok");
  });

  it("gives 14 days of grace from the first failure, then blocks while past due", () => {
    const sub = { status: "past_due", paymentFailedAt: d("2026-09-01") };
    const g = paymentState(sub, d("2026-09-10"));
    expect(g.state).toBe("grace");
    expect(g.state === "grace" && g.blocksOn.toISOString().slice(0, 10)).toBe("2026-09-15");
    expect(paymentState(sub, d("2026-09-15")).state).toBe("blocked");
  });

  it("never blocks an active subscription still being retried", () => {
    expect(paymentState({ status: "active", paymentFailedAt: d("2026-08-01") }, d("2026-09-30")).state).toBe("grace");
  });

  it("blocks unpaid subscriptions at once", () => {
    expect(paymentState({ status: "unpaid", paymentFailedAt: null }).state).toBe("blocked");
  });
});
