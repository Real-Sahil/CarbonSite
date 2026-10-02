// @vitest-environment node
/**
 * Planning obligations stay inside the caller's organisation: ids the body names
 * must be the org's own, and an id from another org updates or deletes nothing.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  prisma: {
    site: { findFirst: vi.fn() },
    contract: { findFirst: vi.fn() },
    organizationMembership: { findFirst: vi.fn() },
    svCommitment: { findFirst: vi.fn() },
    svPlanningObligation: { updateMany: vi.fn(), deleteMany: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => db);
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/billing/limits", () => ({ requireFeature: vi.fn(async () => null) }));
vi.mock("@/lib/auth/session", () => ({
  requireOrgMember: vi.fn(async () => ({ session: { user: { id: "u1" } }, membership: { role: "admin" } })),
  ROLE_GROUPS: { dataReaders: [] },
}));

import { DELETE, PATCH } from "@/app/api/orgs/[orgId]/sv/obligations/[obligationId]/route";

const ctx = { params: Promise.resolve({ orgId: "org-a", obligationId: "ob-of-org-b" }) };
const patch = (body: unknown) =>
  new NextRequest("http://x/api", { method: "PATCH", body: JSON.stringify(body) });

beforeEach(() => vi.clearAllMocks());

describe("planning obligation tenancy", () => {
  it("refuses a site from another org before writing anything", async () => {
    db.prisma.site.findFirst.mockResolvedValue(null);
    const res = await PATCH(patch({ siteId: "site-of-org-b" }), ctx);
    expect(res.status).toBe(404);
    expect(db.prisma.site.findFirst.mock.calls[0][0].where).toEqual({ id: "site-of-org-b", organizationId: "org-a" });
    expect(db.prisma.svPlanningObligation.updateMany).not.toHaveBeenCalled();
  });

  it("refuses a commitment from another org", async () => {
    db.prisma.svCommitment.findFirst.mockResolvedValue(null);
    const res = await PATCH(patch({ commitmentId: "commitment-of-org-b" }), ctx);
    expect(res.status).toBe(404);
    expect(db.prisma.svPlanningObligation.updateMany).not.toHaveBeenCalled();
  });

  it("updates and deletes only inside the org and answers 404 when nothing matched", async () => {
    db.prisma.svPlanningObligation.updateMany.mockResolvedValue({ count: 0 });
    db.prisma.svPlanningObligation.deleteMany.mockResolvedValue({ count: 0 });
    expect((await PATCH(patch({ status: "met" }), ctx)).status).toBe(404);
    expect(db.prisma.svPlanningObligation.updateMany.mock.calls[0][0].where).toEqual({ id: "ob-of-org-b", organizationId: "org-a" });
    expect((await DELETE(new NextRequest("http://x/api", { method: "DELETE" }), ctx)).status).toBe(404);
    expect(db.prisma.svPlanningObligation.deleteMany).toHaveBeenCalledWith({ where: { id: "ob-of-org-b", organizationId: "org-a" } });
  });
});
