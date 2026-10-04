// @vitest-environment node
/**
 * Dashboard layouts: a person saves only their own; only an admin sets or
 * clears the organisation default (audit-logged); every read and write is
 * inside the organisation; ids the registry does not know are refused.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({ prisma: { dashboardLayout: { upsert: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() } } }));
const auth = vi.hoisted(() => ({ userId: "u1", role: "editor" }));
const audit = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => db);
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: audit }));
vi.mock("@/lib/auth/session", () => ({
  requireOrgMember: vi.fn(async () => ({ session: { user: { id: auth.userId } }, membership: { role: auth.role } })),
  ROLE_GROUPS: { editor: ["admin", "editor"], dataReaders: ["admin", "editor", "viewer"], contractManagers: [], projectManagers: [] },
  AuthError: class AuthError extends Error {},
}));

import { DELETE, PUT } from "@/app/api/orgs/[orgId]/dashboard-layout/route";
import { loadStoredLayout } from "@/lib/dashboard/layout-store";

const ctx = { params: Promise.resolve({ orgId: "org1" }) };
const layout = { order: ["headline", "facilities"], hidden: ["facilities"], widths: { headline: "full" } };
const put = (body: unknown) => PUT(new NextRequest("http://x/api", { method: "PUT", body: JSON.stringify(body) }), ctx);

beforeEach(() => {
  Object.values(db.prisma.dashboardLayout).forEach((f) => f.mockReset());
  audit.mockReset();
  auth.userId = "u1";
  auth.role = "editor";
});

describe("dashboard layout API", () => {
  it("saves a personal layout under the caller's own key, inside the organisation, with no audit entry", async () => {
    const res = await put({ scope: "personal", layout });
    expect(res.status).toBe(200);
    expect(db.prisma.dashboardLayout.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId_surface_userKey: { organizationId: "org1", surface: "dashboard", userKey: "u1" } },
        create: expect.objectContaining({ organizationId: "org1", userKey: "u1", ownerUserId: "u1" }),
      }),
    );
    expect(audit).not.toHaveBeenCalled();
  });

  it("refuses the organisation default for a non-admin and writes nothing", async () => {
    const res = await put({ scope: "organisation", layout });
    expect(res.status).toBe(403);
    expect(db.prisma.dashboardLayout.upsert).not.toHaveBeenCalled();
    const del = await DELETE(new NextRequest("http://x/api?scope=organisation", { method: "DELETE" }), ctx);
    expect(del.status).toBe(403);
    expect(db.prisma.dashboardLayout.deleteMany).not.toHaveBeenCalled();
  });

  it("lets an admin set and clear the organisation default, audit-logged", async () => {
    auth.role = "admin";
    expect((await put({ scope: "organisation", layout })).status).toBe(200);
    expect(db.prisma.dashboardLayout.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ userKey: "org", ownerUserId: null }) }));
    await DELETE(new NextRequest("http://x/api?scope=organisation", { method: "DELETE" }), ctx);
    expect(db.prisma.dashboardLayout.deleteMany).toHaveBeenCalledWith({ where: { organizationId: "org1", surface: "dashboard", userKey: "org" } });
    expect(audit).toHaveBeenCalledTimes(2);
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "dashboard_layout.org_default_changed", organizationId: "org1" }));
  });

  it("refuses an unknown widget id and a width that is not half or full", async () => {
    expect((await put({ scope: "personal", layout: { ...layout, order: ["headline", "evil"] } })).status).toBe(422);
    expect((await put({ scope: "personal", layout: { ...layout, widths: { headline: "huge" } } })).status).toBeGreaterThanOrEqual(400);
    expect(db.prisma.dashboardLayout.upsert).not.toHaveBeenCalled();
  });

  it("clears only the caller's own layout", async () => {
    await DELETE(new NextRequest("http://x/api", { method: "DELETE" }), ctx);
    expect(db.prisma.dashboardLayout.deleteMany).toHaveBeenCalledWith({ where: { organizationId: "org1", surface: "dashboard", userKey: "u1" } });
  });
});

describe("loadStoredLayout", () => {
  it("prefers the person's layout, then the organisation's, and reads inside the organisation", async () => {
    db.prisma.dashboardLayout.findMany.mockResolvedValue([
      { userKey: "org", layout: { order: ["facilities"], hidden: [], widths: {} } },
      { userKey: "u1", layout },
    ]);
    const mine = await loadStoredLayout("org1", "u1");
    expect(mine.source).toBe("personal");
    expect(db.prisma.dashboardLayout.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: "org1", surface: "dashboard", userKey: { in: ["org", "u1"] } } }),
    );
    db.prisma.dashboardLayout.findMany.mockResolvedValue([{ userKey: "org", layout: { order: ["facilities"], hidden: [], widths: {} } }]);
    expect((await loadStoredLayout("org1", "u1")).source).toBe("organisation");
    db.prisma.dashboardLayout.findMany.mockResolvedValue([{ userKey: "u1", layout: { nonsense: true } }]);
    expect((await loadStoredLayout("org1", "u1")).source).toBe("preset");
  });
});
