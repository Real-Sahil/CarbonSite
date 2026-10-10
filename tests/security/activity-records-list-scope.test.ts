// @vitest-environment node
/**
 * The records list filters only ever narrow inside the caller's organisation.
 * Every filter is optional; an invalid value is refused before any query.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  prisma: { activityRecord: { findMany: vi.fn(), count: vi.fn() } },
}));
vi.mock("@/lib/db", () => db);
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  requireOrgMember: vi.fn(async () => ({ session: { user: { id: "u1" } }, membership: { role: "viewer" } })),
  ROLE_GROUPS: { dataReaders: [] },
  AuthError: class AuthError extends Error {},
}));

import { GET } from "@/app/api/orgs/[orgId]/activity-records/route";

const ctx = { params: Promise.resolve({ orgId: "org-a" }) };
const get = (qs: string) => GET(new NextRequest(`http://x/api/orgs/org-a/activity-records${qs}`), ctx);
const whereOf = () => db.prisma.activityRecord.findMany.mock.calls[0][0].where;

beforeEach(() => {
  vi.clearAllMocks();
  db.prisma.activityRecord.findMany.mockResolvedValue([]);
  db.prisma.activityRecord.count.mockResolvedValue(0);
});

describe("records list filters", () => {
  it("always scopes to the organisation in the URL, with or without filters", async () => {
    await get("");
    expect(whereOf()).toEqual({ organizationId: "org-a" });
  });

  it("narrows by each filter inside the organisation", async () => {
    await get("?periodId=p1&categoryId=c1&reviewStatus=approved&facilityId=f1&contractId=k1&siteId=s1&supplier=Acme");
    expect(whereOf()).toEqual({
      organizationId: "org-a",
      reportingPeriodId: "p1",
      emissionCategoryId: "c1",
      reviewStatus: "approved",
      facilityId: "f1",
      contractId: "k1",
      siteId: "s1",
      supplierName: { contains: "Acme", mode: "insensitive" },
    });
    expect(db.prisma.activityRecord.count.mock.calls[0][0].where).toEqual(whereOf());
  });

  it("cannot be pointed at another organisation through the query", async () => {
    await get("?organizationId=org-b&facilityId=facility-of-org-b");
    expect(whereOf().organizationId).toBe("org-a");
  });

  it("refuses an unknown review status before querying", async () => {
    const res = await get("?reviewStatus=anything");
    expect(res.status).toBe(422);
    expect(db.prisma.activityRecord.findMany).not.toHaveBeenCalled();
  });

  it("refuses an over-long supplier filter before querying", async () => {
    expect((await get(`?supplier=${"x".repeat(65)}`)).status).toBe(422);
    expect(db.prisma.activityRecord.findMany).not.toHaveBeenCalled();
  });
});
