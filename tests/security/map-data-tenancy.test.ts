// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  prisma: {
    publishedSnapshot: { findFirst: vi.fn() },
    facility: { findMany: vi.fn() },
    dashboardAggregate: { findMany: vi.fn() },
    site: { findMany: vi.fn() },
    dashboardSlice: { groupBy: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => db);
// Postcode lookups would leave the server; the map only needs to know which postcodes were asked for.
const geo = vi.hoisted(() => ({ geocodePostcodes: vi.fn() }));
vi.mock("@/lib/social-value/geocode", () => geo);
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
  geo.geocodePostcodes.mockReset();
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
    expect(db.prisma.site.findMany).not.toHaveBeenCalled();
    expect(db.prisma.dashboardSlice.groupBy).not.toHaveBeenCalled();
  });

  it("reads facilities and aggregates inside the organisation for an own snapshot, one row per facility dimension", async () => {
    db.prisma.publishedSnapshot.findFirst.mockResolvedValue({ id: "s1" });
    db.prisma.site.findMany.mockResolvedValue([]);
    db.prisma.dashboardSlice.groupBy.mockResolvedValue([]);
    db.prisma.facility.findMany.mockResolvedValue([{ id: "f1", name: "Leeds", postcode: null, latitude: 53.8, longitude: -1.5 }]);
    db.prisma.dashboardAggregate.findMany.mockResolvedValue([{ facilityId: "f1", totalCo2e: "5", recordCount: 1 }, { facilityId: "f1", totalCo2e: "7", recordCount: 2 }]);
    const res = await get("?snapshotId=s1");
    expect(res.status).toBe(200);
    expect((await res.json()).sites[0]).toMatchObject({ id: "f1", kg: 12, recordCount: 3 });
    expect(db.prisma.facility.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "org1" } }));
    expect(db.prisma.dashboardAggregate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ organizationId: "org1", snapshotId: "s1", facilityId: { not: null }, emissionCategoryId: null }) }),
    );
  });

  it("places project sites from their postcode, totals them from this snapshot's slices inside the organisation, and never reads another organisation's", async () => {
    db.prisma.publishedSnapshot.findFirst.mockResolvedValue({ id: "s1" });
    db.prisma.facility.findMany.mockResolvedValue([]);
    db.prisma.dashboardAggregate.findMany.mockResolvedValue([]);
    db.prisma.site.findMany.mockResolvedValue([
      { id: "x1", name: "Cardiff Bay", projectId: "p1", postcode: "CF10 4QA", city: "Cardiff", project: { name: "Bay Block" } },
      { id: "x2", name: "No postcode", projectId: "p1", postcode: null, city: null, project: { name: "Bay Block" } },
    ]);
    db.prisma.dashboardSlice.groupBy.mockResolvedValue([{ siteId: "x1", _sum: { totalCo2e: "40", recordCount: 4 } }]);
    geo.geocodePostcodes.mockResolvedValue(new Map([["CF10 4QA", { latitude: 51.47, longitude: -3.16 }]]));
    const res = await get("?snapshotId=s1");
    expect(res.status).toBe(200);
    const sites = (await res.json()).sites;
    expect(sites.find((s: { id: string }) => s.id === "x1")).toMatchObject({ kind: "site", kg: 40, recordCount: 4, latitude: 51.47, longitude: -3.16, projectId: "p1" });
    expect(sites.find((s: { id: string }) => s.id === "x2")).toMatchObject({ latitude: null, longitude: null });
    expect(db.prisma.site.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "org1" } }));
    expect(db.prisma.dashboardSlice.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: "org1", snapshotId: "s1" }) }));
  });
});
