// @vitest-environment node
/**
 * Local spend must stay inside the caller's organisation: a site or supplier id
 * from another org finds nothing, and deleting one removes nothing.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  prisma: {
    site: { findFirst: vi.fn() },
    activityRecord: { findMany: vi.fn() },
    svSupplierLocation: { findMany: vi.fn(), deleteMany: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => db);
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  requireOrgMember: vi.fn(async () => ({ session: { user: { id: "u1" } }, membership: { role: "admin" } })),
}));

import { loadLocalSpend } from "@/lib/social-value/local-spend-load";
import { DELETE } from "@/app/api/orgs/[orgId]/sv/local-spend/suppliers/[supplierId]/route";

beforeEach(() => vi.clearAllMocks());

describe("local spend tenancy", () => {
  it("looks a site up only inside the org and refuses another org's site", async () => {
    db.prisma.site.findFirst.mockResolvedValue(null);
    const out = await loadLocalSpend("org-a", { siteId: "site-of-org-b", radiusMiles: 20 });
    expect(out).toMatchObject({ ok: false, code: "SITE_NOT_FOUND" });
    expect(db.prisma.site.findFirst.mock.calls[0][0].where).toEqual({ id: "site-of-org-b", organizationId: "org-a" });
    expect(db.prisma.activityRecord.findMany).not.toHaveBeenCalled();
  });

  it("deletes a supplier only within the org and answers 404 when nothing matched", async () => {
    db.prisma.svSupplierLocation.deleteMany.mockResolvedValue({ count: 0 });
    const res = await DELETE(new NextRequest("http://x/api"), {
      params: Promise.resolve({ orgId: "org-a", supplierId: "supplier-of-org-b" }),
    });
    expect(res.status).toBe(404);
    expect(db.prisma.svSupplierLocation.deleteMany).toHaveBeenCalledWith({
      where: { id: "supplier-of-org-b", organizationId: "org-a" },
    });
  });
});
