// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

const list = vi.fn();
vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({ prices: { list } })),
}));

const sub = (priceId: string, lookupKey: string | null) =>
  ({ items: { data: [{ price: { id: priceId, lookup_key: lookupKey } }] } }) as unknown as Stripe.Subscription;

describe("prices by lookup key", () => {
  beforeEach(() => {
    vi.resetModules();
    list.mockReset();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_offline");
    vi.stubEnv("STRIPE_PRICE_GROWTH_ANNUAL", "price_env_growth_annual");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("uses the price with the plan's lookup key in the key's own account", async () => {
    list.mockResolvedValue({ data: [{ id: "price_live_starter_monthly" }] });
    const { resolvePriceId } = await import("../stripe");
    expect(await resolvePriceId("starter", "monthly")).toBe("price_live_starter_monthly");
    expect(list).toHaveBeenCalledWith({ lookup_keys: ["starter_monthly"], active: true, limit: 1 });
  });

  it("falls back to the env price ID when no price has the key", async () => {
    list.mockResolvedValue({ data: [] });
    const { resolvePriceId } = await import("../stripe");
    expect(await resolvePriceId("growth", "annual")).toBe("price_env_growth_annual");
  });

  it("maps a subscription to its plan by lookup key, then by env price ID", async () => {
    const { planForSubscription } = await import("../stripe");
    expect(planForSubscription(sub("price_any", "growth_monthly"))).toBe("growth");
    expect(planForSubscription(sub("price_any", "starter_annual"))).toBe("starter");
    expect(planForSubscription(sub("price_env_growth_annual", null))).toBe("growth");
    expect(planForSubscription(sub("price_unknown", "enterprise_custom"))).toBeNull();
  });
});
