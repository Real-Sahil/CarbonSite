import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  publishedSnapshot: { findFirst: vi.fn() },
  facility: { findMany: vi.fn() },
  dashboardAggregate: { findMany: vi.fn() },
  site: { findMany: vi.fn() },
  dashboardSlice: { groupBy: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/social-value/geocode", () => ({ geocodePostcodes: vi.fn(async () => new Map()) }));

import { loadLiveSites, loadSnapshotSites } from "../load";

beforeEach(() => {
  for (const group of Object.values(prisma)) for (const fn of Object.values(group)) fn.mockReset();
  prisma.facility.findMany.mockResolvedValue([]);
  prisma.dashboardAggregate.findMany.mockResolvedValue([]);
  prisma.site.findMany.mockResolvedValue([]);
  prisma.dashboardSlice.groupBy.mockResolvedValue([]);
});

describe("loadLiveSites", () => {
  it("reads only live rows of the period, always inside the organisation", async () => {
    await loadLiveSites("org-1", "period-9");
    const agg = prisma.dashboardAggregate.findMany.mock.calls[0][0].where;
    const slices = prisma.dashboardSlice.groupBy.mock.calls[0][0].where;
    for (const where of [agg, slices]) {
      expect(where.organizationId).toBe("org-1");
      expect(where.snapshotId).toBeNull();
      expect(where.reportingPeriodId).toBe("period-9");
    }
    expect(prisma.publishedSnapshot.findFirst).not.toHaveBeenCalled();
  });
});

describe("loadSnapshotSites", () => {
  it("returns null for a snapshot that is not this organisation's, and never reads its rows", async () => {
    prisma.publishedSnapshot.findFirst.mockResolvedValue(null);
    expect(await loadSnapshotSites("org-1", "snap-x")).toBeNull();
    expect(prisma.dashboardAggregate.findMany).not.toHaveBeenCalled();
  });

  it("reads the rows of its snapshot, not the live ones", async () => {
    prisma.publishedSnapshot.findFirst.mockResolvedValue({ id: "snap-1" });
    await loadSnapshotSites("org-1", "snap-1");
    const where = prisma.dashboardAggregate.findMany.mock.calls[0][0].where;
    expect(where.snapshotId).toBe("snap-1");
    expect(where.organizationId).toBe("org-1");
  });
});
