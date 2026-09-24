// @vitest-environment node
import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { pendingPaymentClientSecret, subscriptionGrantsPlan } from "../stripe";

const sub = (status: string, piStatus?: string) =>
  ({
    status,
    latest_invoice: piStatus ? { payment_intent: { status: piStatus, client_secret: "pi_secret" } } : null,
  }) as unknown as Stripe.Subscription;

describe("subscription payment state", () => {
  it("returns the client secret only when the bank must confirm the first payment", () => {
    expect(pendingPaymentClientSecret(sub("incomplete", "requires_action"))).toBe("pi_secret");
    expect(pendingPaymentClientSecret(sub("incomplete", "requires_payment_method"))).toBeNull();
    expect(pendingPaymentClientSecret(sub("active", "succeeded"))).toBeNull();
  });

  it("grants a plan only for a paid subscription", () => {
    expect(subscriptionGrantsPlan("active")).toBe(true);
    expect(subscriptionGrantsPlan("trialing")).toBe(true);
    for (const s of ["incomplete", "past_due", "unpaid", "canceled", "incomplete_expired"] as const) {
      expect(subscriptionGrantsPlan(s)).toBe(false);
    }
  });
});
