// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { appraisalPrice, coveredCost, e18Gaps, netOfCarbonPrice, pricesInForce, type CarbonPrice } from "../index";

const db = vi.hoisted(() => ({
  internalCarbonPrice: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), delete: vi.fn() },
  organizationDatapointStatus: { findFirst: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/auth/session", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/session")>()),
  requireOrgMember: vi.fn().mockResolvedValue({ session: { user: { id: "u1" } }, membership: { role: "admin" } }),
}));

const price = (over: Partial<CarbonPrice>): CarbonPrice => ({
  id: "p",
  name: "Shadow",
  priceType: "shadow",
  pricePerTonne: 100,
  currency: "GBP",
  scopes: [1, 2],
  appliesTo: ["capital_investment"],
  effectiveFrom: new Date("2026-01-01"),
  effectiveTo: null,
  basis: "DESNZ central appraisal value",
  ...over,
});

describe("internal carbon price", () => {
  const today = new Date("2026-09-23");

  it("picks the price in force, preferring a shadow price and the latest start", () => {
    const prices = [
      price({ id: "old", effectiveFrom: new Date("2025-01-01"), effectiveTo: new Date("2025-12-31") }),
      price({ id: "fee", priceType: "internal_fee", pricePerTonne: 30 }),
      price({ id: "shadow-a", effectiveFrom: new Date("2026-01-01") }),
      price({ id: "shadow-b", effectiveFrom: new Date("2026-07-01"), pricePerTonne: 120 }),
      price({ id: "future", effectiveFrom: new Date("2027-01-01") }),
    ];
    expect(pricesInForce(prices, today).map((p) => p.id)).toEqual(["shadow-b", "fee", "shadow-a"]);
    expect(appraisalPrice(prices, today)?.id).toBe("shadow-b");
    expect(appraisalPrice(prices.filter((p) => p.priceType !== "shadow"), today)?.id).toBe("fee");
    expect(appraisalPrice([prices[0]], today)).toBeNull();
  });

  it("covers only the price's scopes and reports the share of gross emissions", () => {
    const r = coveredCost([{ scope: 1, tco2e: 100 }, { scope: 2, tco2e: 50 }, { scope: 3, tco2e: 850 }], price({}));
    expect(r).toEqual({ coveredTco2e: 150, grossTco2e: 1000, share: 0.15, cost: 15_000 });
  });

  it("nets the marginal abatement cost against the price", () => {
    expect(netOfCarbonPrice(80, 100)).toEqual({ netCostPerTco2e: -20, paysAtPrice: true });
    expect(netOfCarbonPrice(150, 100).paysAtPrice).toBe(false);
  });

  it("lists what ESRS E1-8 still needs", () => {
    expect(e18Gaps([], today)[0]).toMatch(/No internal carbon price/);
    expect(e18Gaps([price({ effectiveTo: new Date("2026-01-31") })], today)).toEqual(["No internal carbon price is in force today."]);
    expect(e18Gaps([price({ basis: null, appliesTo: [] })], today)).toHaveLength(2);
    expect(e18Gaps([price({})], today)).toEqual([]);
  });
});

describe("E1-8 resolver", () => {
  beforeEach(() => vi.clearAllMocks());

  it("respects a manual 'no price used' entry when the org has no prices, scoped to the org", async () => {
    const { runResolver } = await import("@/lib/compliance/datapoint-resolvers");
    db.internalCarbonPrice.findMany.mockResolvedValue([]);
    db.organizationDatapointStatus.findFirst.mockResolvedValue({ status: "satisfied", evidenceSummary: "No internal carbon price is used." });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await runResolver("internal_carbon_price", "org-a", db as any);
    expect(r).toEqual({ status: "satisfied", evidenceSummary: "No internal carbon price is used." });
    expect(db.internalCarbonPrice.findMany.mock.calls[0][0].where).toEqual({ organizationId: "org-a" });
    expect(db.organizationDatapointStatus.findFirst.mock.calls[0][0].where.organizationId).toBe("org-a");
  });

  it("is satisfied by a complete price in force", async () => {
    const { runResolver } = await import("@/lib/compliance/datapoint-resolvers");
    db.internalCarbonPrice.findMany.mockResolvedValue([{ ...price({}), effectiveFrom: new Date("2020-01-01") }]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await runResolver("internal_carbon_price", "org-a", db as any);
    expect(r?.status).toBe("satisfied");
    expect(r?.evidenceSummary).toContain("£100/tCO2e");
  });
});

describe("carbon price routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("will not delete another organisation's price", async () => {
    const { DELETE } = await import("@/app/api/orgs/[orgId]/carbon-prices/[priceId]/route");
    db.internalCarbonPrice.findFirst.mockResolvedValue(null);
    const res = await DELETE(new NextRequest("http://localhost/x", { method: "DELETE" }), {
      params: Promise.resolve({ orgId: "org-a", priceId: "price-of-org-b" }),
    });
    expect(res.status).toBe(404);
    expect(db.internalCarbonPrice.findFirst.mock.calls[0][0].where).toEqual({ id: "price-of-org-b", organizationId: "org-a" });
    expect(db.internalCarbonPrice.delete).not.toHaveBeenCalled();
  });

  it("creates a price in the caller's organisation from the path, not the body", async () => {
    const { POST } = await import("@/app/api/orgs/[orgId]/carbon-prices/route");
    db.internalCarbonPrice.create.mockImplementation(({ data }) => ({ id: "new", ...data }));
    const res = await POST(
      new NextRequest("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({
          organizationId: "org-b",
          name: "Shadow",
          priceType: "shadow",
          pricePerTonne: 85,
          currency: "gbp",
          scopes: [2, 1, 1],
          effectiveFrom: "2026-01-01",
        }),
      }),
      { params: Promise.resolve({ orgId: "org-a" }) },
    );
    expect(res.status).toBe(201);
    expect(db.internalCarbonPrice.create.mock.calls[0][0].data).toMatchObject({ organizationId: "org-a", currency: "GBP", scopes: [1, 2] });
  });
});
