// @vitest-environment node
/** The Zapier action takes a category code; the record must store the category's id, not the code. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  organization: { findUnique: vi.fn() },
  emissionCategory: { findUnique: vi.fn() },
  facility: { findUnique: vi.fn() },
  reportingPeriod: { findFirst: vi.fn() },
  organizationMembership: { findFirst: vi.fn() },
  activityRecord: { create: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/security/org-refs", () => ({ orgRefsError: vi.fn(async () => null) }));
vi.mock("@/lib/integrations/zapier", () => ({
  validateZapierConfig: vi.fn(),
  verifyZapierApiKey: vi.fn(async () => {}),
  ZapierAuthError: class extends Error {},
}));

import { POST } from "@/app/api/zapier/actions/activity-record-create/route";

beforeEach(() => {
  vi.clearAllMocks();
  db.organization.findUnique.mockResolvedValue({ id: "org-a" });
  db.emissionCategory.findUnique.mockResolvedValue({ id: "cat-id-1", code: "s1-stationary" });
  db.reportingPeriod.findFirst.mockResolvedValue({ id: "period-1" });
  db.organizationMembership.findFirst.mockResolvedValue({ userId: "user-1" });
  db.activityRecord.create.mockImplementation(async ({ data }) => ({
    id: "rec-1",
    amount: data.amount,
    unit: data.unit,
    emissionCategoryId: data.emissionCategoryId,
    createdAt: new Date(),
  }));
});

describe("zapier activity-record-create", () => {
  it("stores the category id and answers with the code", async () => {
    const res = await POST(
      new NextRequest("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({
          organizationId: "org-a",
          apiKey: "k",
          quantity: 10,
          unit: "kWh",
          category: "s1-stationary",
        }),
      }),
    );
    expect(res.status).toBe(201);
    expect(db.activityRecord.create.mock.calls[0][0].data.emissionCategoryId).toBe("cat-id-1");
    expect((await res.json()).record.category).toBe("s1-stationary");
  });
});
