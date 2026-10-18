import { describe, expect, it, vi } from "vitest";

const db = { wasteRecord: { findMany: vi.fn() } };
const routes = (...disposalRoute: string[]) => disposalRoute.map((r) => ({ disposalRoute: r }));

async function run() {
  const { runResolver } = await import("@/lib/compliance/datapoint-resolvers");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return runResolver("waste_diversion_disclosed", "org-a", db as any);
}

describe("waste diversion resolver", () => {
  it("is partial when every route is landfill, hazardous landfill included", async () => {
    db.wasteRecord.findMany.mockResolvedValue(routes("landfill_mixed", "hazardous_landfill"));
    expect((await run())?.status).toBe("partial");
  });

  it("is partial when the only route is one it does not recognise, never a diversion", async () => {
    db.wasteRecord.findMany.mockResolvedValue(routes("dump"));
    expect((await run())?.status).toBe("partial");
  });

  it("is satisfied when one route is recycling or recovery", async () => {
    db.wasteRecord.findMany.mockResolvedValue(routes("landfill_mixed", "recycling_metal"));
    expect((await run())?.status).toBe("satisfied");
  });
});
