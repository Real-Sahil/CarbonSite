// @vitest-environment node
// The supplier data form (app/supplier-data/[token]) posts activity data, an
// emissions figure or spend. Its payload once did not match this route, so no
// supplier could submit; this holds the two together.
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  supplierDataRequest: { findUnique: vi.fn(), update: vi.fn() },
  emissionCategory: { findUnique: vi.fn() },
  reportingPeriod: { findUnique: vi.fn() },
  supplierReport: { create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));

import { POST } from "@/app/api/supplier-data/[token]/route";

const call = (body: unknown) =>
  POST(new Request("http://x/api/supplier-data/tok", { method: "POST", body: JSON.stringify(body) }) as never, { params: Promise.resolve({ token: "tok" }) });

beforeEach(() => {
  vi.clearAllMocks();
  db.supplierDataRequest.findUnique.mockResolvedValue({
    id: "r1", organizationId: "o1", reportingPeriodId: "p1", supplierEmail: "a@b.co", supplierName: "B Ltd",
    categoryCode: "s3-purchased-goods", status: "sent", expiresAt: new Date(Date.now() + 86_400_000),
  });
  db.emissionCategory.findUnique.mockResolvedValue({ id: "c1" });
  db.reportingPeriod.findUnique.mockResolvedValue({ startDate: new Date("2025-01-01") });
  db.supplierReport.create.mockResolvedValue({ id: "sr1" });
});

describe("supplier data submission", () => {
  it.each([
    ["kWh", "activity_based"],
    ["tonne", "activity_based"],
    ["tCO2e", "direct_measurement"],
    ["EUR", "spend_based"],
    ["AUD", "spend_based"],
  ])("accepts %s from the form and records it as %s", async (unit, method) => {
    const res = await call({ totalAmount: 1200, unit, notes: "Annual electricity", supplierName: "B Ltd" });
    expect(res.status).toBe(200);
    expect(db.supplierReport.create.mock.calls[0][0].data).toMatchObject({ unit, calculationMethod: method, totalAmount: 1200, notes: "Annual electricity" });
  });

  it("refuses an unknown unit, a zero amount and an expired link", async () => {
    expect((await call({ totalAmount: 5, unit: "furlong" })).status).toBe(400);
    expect((await call({ totalAmount: 0, unit: "kg" })).status).toBe(400);
    db.supplierDataRequest.findUnique.mockResolvedValue({ id: "r1", expiresAt: new Date(0), status: "sent" });
    expect((await call({ totalAmount: 5, unit: "kg" })).status).toBe(410);
    expect(db.supplierReport.create).not.toHaveBeenCalled();
  });
});
