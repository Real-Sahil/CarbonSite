// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  prisma: {
    publishedSnapshot: { findFirst: vi.fn() },
    facility: { findMany: vi.fn() },
    dashboardAggregate: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => db);
vi.mock("@/lib/auth/session", () => ({
  requireOrgMember: vi.fn(async () => ({ session: { user: { id: "u1" } }, membership: { role: "viewer" } })),
  ROLE_GROUPS: { dataReaders: ["viewer"] },
  AuthError: class AuthError extends Error {},
}));

import { GET } from "@/app/api/orgs/[orgId]/map-data/route";

const ctx = { params: Promise.resolve({ orgId: "org1" }) };
const get = (qs: string) => GET(new NextRequest(`http://x/api${qs}`), ctx);

beforeEach(() => {
  Object.values(db.prisma).forEach((m) => Object.values(m).forEach((f) => f.mockReset()));
});

describe("map-data API", () => {
  it("needs a snapshot id", async () => {
    expect((await get("")).status).toBe(422);
  });

  it("another organisation's snapshot is not found and nothing else is read", async () => {
    db.prisma.publishedSnapshot.findFirst.mockResolvedValue(null);
    const res = await get("?snapshotId=foreign");
    expect(res.status).toBe(404);
    expect(db.prisma.publishedSnapshot.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "foreign", organizationId: "org1" } }));
    expect(db.prisma.facility.findMany).not.toHaveBeenCalled();
    expect(db.prisma.dashboardAggregate.findMany).not.toHaveBeenCalled();
  });

  it("reads facilities and aggregates inside the organisation for an own snapshot, one row per facility dimension", async () => {
    db.prisma.publishedSnapshot.findFirst.mockResolvedValue({ id: "s1" });
    db.prisma.facility.findMany.mockResolvedValue([{ id: "f1", name: "Leeds", latitude: 53.8, longitude: -1.5 }]);
    db.prisma.dashboardAggregate.findMany.mockResolvedValue([{ facilityId: "f1", totalCo2e: "5", recordCount: 1 }, { facilityId: "f1", totalCo2e: "7", recordCount: 2 }]);
    const res = await get("?snapshotId=s1");
    expect(res.status).toBe(200);
    expect((await res.json()).sites[0]).toMatchObject({ id: "f1", kg: 12, recordCount: 3 });
    expect(db.prisma.facility.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "org1" } }));
    expect(db.prisma.dashboardAggregate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ organizationId: "org1", snapshotId: "s1", facilityId: { not: null }, emissionCategoryId: null }) }),
    );
  });
});
