import { describe, it, expect, vi, beforeEach } from "vitest";
import { recordUsage, getUsageSummary } from "@/lib/billing/usage";

vi.mock("@/lib/db", () => ({
  prisma: {
    usageEvent: {
      create: vi.fn().mockResolvedValue({}),
      groupBy: vi.fn().mockResolvedValue([]),
    },
  },
}));

import { prisma } from "@/lib/db";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("recordUsage", () => {
  it("creates a usage event with quantity 1 by default", async () => {
    await recordUsage({ organizationId: "org-1", eventType: "report.generated" });
    expect(prisma.usageEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "org-1",
          eventType: "report.generated",
          quantity: 1,
        }),
      }),
    );
  });

  it("accepts a custom quantity", async () => {
    await recordUsage({ organizationId: "org-1", eventType: "api.request", quantity: 10 });
    expect(prisma.usageEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ quantity: 10 }),
      }),
    );
  });
});

describe("getUsageSummary", () => {
  it("returns empty object when no events", async () => {
    vi.mocked(prisma.usageEvent.groupBy).mockResolvedValue([]);
    const result = await getUsageSummary("org-1", new Date("2025-01-01"), new Date("2025-01-31"));
    expect(result).toEqual({});
  });

  it("maps event types to summed quantities", async () => {
    vi.mocked(prisma.usageEvent.groupBy).mockResolvedValue([
      { eventType: "report.generated", _sum: { quantity: 5 } } as any,
      { eventType: "import.committed", _sum: { quantity: 12 } } as any,
    ]);
    const result = await getUsageSummary("org-1", new Date("2025-01-01"), new Date("2025-01-31"));
    expect(result["report.generated"]).toBe(5);
    expect(result["import.committed"]).toBe(12);
  });

  it("handles null _sum.quantity as 0", async () => {
    vi.mocked(prisma.usageEvent.groupBy).mockResolvedValue([
      { eventType: "calculation.run", _sum: { quantity: null } } as any,
    ]);
    const result = await getUsageSummary("org-1", new Date("2025-01-01"), new Date("2025-01-31"));
    expect(result["calculation.run"]).toBe(0);
  });
});
