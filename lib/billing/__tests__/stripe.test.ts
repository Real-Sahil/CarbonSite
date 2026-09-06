import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getPriceId, planForPriceId, getSubscriptionPriceId } from "@/lib/billing/stripe";
import type Stripe from "stripe";

const ENV_KEYS = [
  "STRIPE_PRICE_STARTER_MONTHLY",
  "STRIPE_PRICE_STARTER_ANNUAL",
  "STRIPE_PRICE_GROWTH_MONTHLY",
  "STRIPE_PRICE_GROWTH_ANNUAL",
] as const;

describe("getPriceId / planForPriceId", () => {
  beforeEach(() => {
    vi.stubEnv("STRIPE_PRICE_STARTER_MONTHLY", "price_starter_monthly");
    vi.stubEnv("STRIPE_PRICE_STARTER_ANNUAL", "price_starter_annual");
    vi.stubEnv("STRIPE_PRICE_GROWTH_MONTHLY", "price_growth_monthly");
    vi.stubEnv("STRIPE_PRICE_GROWTH_ANNUAL", "price_growth_annual");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("resolves the configured price ID for each plan/interval", () => {
    expect(getPriceId("starter", "monthly")).toBe("price_starter_monthly");
    expect(getPriceId("starter", "annual")).toBe("price_starter_annual");
    expect(getPriceId("growth", "monthly")).toBe("price_growth_monthly");
    expect(getPriceId("growth", "annual")).toBe("price_growth_annual");
  });

  it("throws a clear error when the env var isn't set, rather than subscribing to nothing", () => {
    vi.stubEnv("STRIPE_PRICE_GROWTH_MONTHLY", "");
    expect(() => getPriceId("growth", "monthly")).toThrow(/STRIPE_PRICE_GROWTH_MONTHLY/);
  });

  it("round-trips a price ID back to its plan", () => {
    expect(planForPriceId("price_growth_annual")).toBe("growth");
    expect(planForPriceId("price_starter_monthly")).toBe("starter");
  });

  it("returns null for a price ID that matches no configured plan", () => {
    expect(planForPriceId("price_something_else")).toBeNull();
  });

  it("returns null (never guesses) when the same price ID happens to not be configured for any plan", () => {
    for (const key of ENV_KEYS) vi.stubEnv(key, "");
    expect(planForPriceId("price_starter_monthly")).toBeNull();
  });
});

describe("getSubscriptionPriceId", () => {
  it("reads the price ID off the subscription's first item", () => {
    const subscription = {
      items: { data: [{ price: { id: "price_abc123" } }] },
    } as unknown as Stripe.Subscription;
    expect(getSubscriptionPriceId(subscription)).toBe("price_abc123");
  });

  it("returns null when the subscription has no items", () => {
    const subscription = { items: { data: [] } } as unknown as Stripe.Subscription;
    expect(getSubscriptionPriceId(subscription)).toBeNull();
  });
});
