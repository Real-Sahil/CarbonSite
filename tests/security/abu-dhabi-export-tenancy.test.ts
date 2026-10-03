// @vitest-environment node
/**
 * The Abu Dhabi export reads one facility's calculations, always inside the
 * caller's organisation: another org's facility id is a 404 and nothing is read.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  prisma: {
    facility: { findFirst: vi.fn() },
    publishedSnapshot: { findFirst: vi.fn() },
    emissionCalculation: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => db);
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  requireOrgMember: vi.fn(async () => ({ session: { user: { id: "u1" } }, membership: { role: "admin" } })),
  AuthError: class AuthError extends Error {},
}));

import { GET } from "@/app/api/orgs/[orgId]/exports/abu-dhabi-mrv/route";

const ctx = { params: Promise.resolve({ orgId: "org-a" }) };
const req = (q: string) => new NextRequest(`http://x/api?${q}`);

beforeEach(() => vi.clearAllMocks());

describe("Abu Dhabi export tenancy", () => {
  it("looks the facility up inside the org and reads nothing when it is another org's", async () => {
    db.prisma.facility.findFirst.mockResolvedValue(null);
    const res = await GET(req("facilityId=fac-of-org-b&year=2025"), ctx);
    expect(res.status).toBe(404);
    expect(db.prisma.facility.findFirst.mock.calls[0][0].where).toEqual({ id: "fac-of-org-b", organizationId: "org-a" });
    expect(db.prisma.publishedSnapshot.findFirst).not.toHaveBeenCalled();
    expect(db.prisma.emissionCalculation.findMany).not.toHaveBeenCalled();
  });

  it("refuses a year no published snapshot covers, and scopes calculations to the org and facility", async () => {
    db.prisma.facility.findFirst.mockResolvedValue({ id: "f1", name: "Plant", organization: { name: "Acme" }, legalEntity: null });
    db.prisma.publishedSnapshot.findFirst.mockResolvedValue(null);
    const none = await GET(req("facilityId=f1&year=2025"), ctx);
    expect(none.status).toBe(422);
    expect(db.prisma.publishedSnapshot.findFirst.mock.calls[0][0].where.organizationId).toBe("org-a");

    db.prisma.publishedSnapshot.findFirst.mockResolvedValue({ id: "s1", calculationRunId: "r1", version: 1 });
    db.prisma.emissionCalculation.findMany.mockResolvedValue([]);
    const ok = await GET(req("facilityId=f1&year=2025"), ctx);
    expect(ok.status).toBe(200);
    const where = db.prisma.emissionCalculation.findMany.mock.calls[0][0].where;
    expect(where.organizationId).toBe("org-a");
    expect(where.activityRecord).toMatchObject({ organizationId: "org-a", facilityId: "f1", emissionCategory: { scope: 1 } });
  });

  it("rejects a malformed year before touching the database", async () => {
    const res = await GET(req("facilityId=f1&year=abc"), ctx);
    expect(res.status).toBe(422);
    expect(db.prisma.facility.findFirst).not.toHaveBeenCalled();
  });
});
