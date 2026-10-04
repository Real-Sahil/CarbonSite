// @vitest-environment node
/**
 * Saved views stay inside the caller's organisation and respect ownership:
 * ids in filters must be the org's own, private views are invisible to others,
 * only editors share, only the owner (or an admin, for shared ones) changes or
 * deletes, and shared changes are audit-logged.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  prisma: {
    facility: { findFirst: vi.fn() },
    contract: { findFirst: vi.fn() },
    legalEntity: { findFirst: vi.fn() },
    savedView: {
      findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(), create: vi.fn(),
      updateMany: vi.fn(), deleteMany: vi.fn(),
    },
  },
}));
const auth = vi.hoisted(() => ({ userId: "u1", role: "editor" }));
const audit = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => db);
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: audit }));
vi.mock("@/lib/auth/session", () => ({
  requireOrgMember: vi.fn(async () => ({ session: { user: { id: auth.userId } }, membership: { role: auth.role } })),
  ROLE_GROUPS: {
    editor: ["admin", "editor"],
    dataReaders: ["admin", "editor", "viewer"],
    contractManagers: [],
    projectManagers: [],
  },
  AuthError: class AuthError extends Error {},
}));

import { GET, POST } from "@/app/api/orgs/[orgId]/saved-views/route";
import { DELETE, PATCH } from "@/app/api/orgs/[orgId]/saved-views/[viewId]/route";

const orgCtx = { params: Promise.resolve({ orgId: "org-a" }) };
const viewCtx = { params: Promise.resolve({ orgId: "org-a", viewId: "v1" }) };
const req = (method: string, body?: unknown, url = "http://x/api") =>
  new NextRequest(url, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const create = { surface: "dashboard", name: "Q3 sites", filters: { country: "GB" } };

beforeEach(() => {
  vi.clearAllMocks();
  auth.userId = "u1";
  auth.role = "editor";
  db.prisma.savedView.count.mockResolvedValue(0);
  db.prisma.savedView.create.mockResolvedValue({ id: "v1", surface: "dashboard", shared: false });
});

describe("listing", () => {
  it("returns the caller's own views and shared ones, inside the org", async () => {
    db.prisma.savedView.findMany.mockResolvedValue([]);
    await GET(req("GET", undefined, "http://x/api?surface=dashboard"), orgCtx);
    expect(db.prisma.savedView.findMany.mock.calls[0][0].where).toEqual({
      organizationId: "org-a",
      surface: "dashboard",
      OR: [{ ownerUserId: "u1" }, { shared: true }],
    });
  });

  it("refuses a missing or unknown page", async () => {
    expect((await GET(req("GET"), orgCtx)).status).toBe(422);
    expect((await GET(req("GET", undefined, "http://x/api?surface=admin"), orgCtx)).status).toBe(422);
  });
});

describe("creating", () => {
  it("saves under the org in the URL and the signed-in user, whatever the body carries", async () => {
    const res = await POST(req("POST", { ...create, organizationId: "org-b", ownerUserId: "someone" }), orgCtx);
    expect(res.status).toBe(201);
    const data = db.prisma.savedView.create.mock.calls[0][0].data;
    expect(data.organizationId).toBe("org-a");
    expect(data.ownerUserId).toBe("u1");
  });

  it("refuses ids from another org before writing anything", async () => {
    db.prisma.contract.findFirst.mockResolvedValue(null);
    const res = await POST(req("POST", { ...create, filters: { contractId: "contract-of-org-b" } }), orgCtx);
    expect(res.status).toBe(404);
    expect(db.prisma.contract.findFirst.mock.calls[0][0].where).toEqual({ id: "contract-of-org-b", organizationId: "org-a" });
    expect(db.prisma.savedView.create).not.toHaveBeenCalled();

    db.prisma.legalEntity.findFirst.mockResolvedValue(null);
    expect((await POST(req("POST", { ...create, filters: { entityId: "entity-of-org-b" } }), orgCtx)).status).toBe(404);
    expect(db.prisma.legalEntity.findFirst.mock.calls[0][0].where).toEqual({ id: "entity-of-org-b", organizationId: "org-a" });
  });

  it("refuses filters the page does not read", async () => {
    expect((await POST(req("POST", { ...create, filters: { organizationId: "org-b" } }), orgCtx)).status).toBe(422);
    expect(db.prisma.savedView.create).not.toHaveBeenCalled();
  });

  it("lets only editors and admins share, and audit-logs the share", async () => {
    auth.role = "viewer";
    expect((await POST(req("POST", { ...create, shared: true }), orgCtx)).status).toBe(403);
    expect((await POST(req("POST", create), orgCtx)).status).toBe(201);
    expect(audit).not.toHaveBeenCalled();

    auth.role = "editor";
    db.prisma.savedView.create.mockResolvedValue({ id: "v2", surface: "dashboard", shared: true });
    expect((await POST(req("POST", { ...create, shared: true }), orgCtx)).status).toBe(201);
    expect(audit.mock.calls[0][0]).toMatchObject({ organizationId: "org-a", action: "saved_view.created" });
  });

  it("answers 409 for a duplicate name and 422 past the per-page limit", async () => {
    db.prisma.savedView.create.mockRejectedValue({ code: "P2002" });
    expect((await POST(req("POST", create), orgCtx)).status).toBe(409);
    db.prisma.savedView.count.mockResolvedValue(50);
    expect((await POST(req("POST", create), orgCtx)).status).toBe(422);
  });
});

describe("changing and deleting", () => {
  const mine = { id: "v1", ownerUserId: "u1", shared: false, surface: "dashboard" };
  const othersShared = { id: "v1", ownerUserId: "u2", shared: true, surface: "dashboard" };

  it("looks a view up inside the org and only among the caller's own or shared ones", async () => {
    db.prisma.savedView.findFirst.mockResolvedValue(null);
    expect((await PATCH(req("PATCH", { name: "x" }), viewCtx)).status).toBe(404);
    expect((await DELETE(req("DELETE"), viewCtx)).status).toBe(404);
    expect(db.prisma.savedView.findFirst.mock.calls[0][0].where).toEqual({
      id: "v1",
      organizationId: "org-a",
      OR: [{ ownerUserId: "u1" }, { shared: true }],
    });
    expect(db.prisma.savedView.updateMany).not.toHaveBeenCalled();
    expect(db.prisma.savedView.deleteMany).not.toHaveBeenCalled();
  });

  it("lets the owner rename and delete a private view without an audit entry", async () => {
    db.prisma.savedView.findFirst.mockResolvedValue(mine);
    db.prisma.savedView.updateMany.mockResolvedValue({ count: 1 });
    db.prisma.savedView.deleteMany.mockResolvedValue({ count: 1 });
    expect((await PATCH(req("PATCH", { name: "Renamed" }), viewCtx)).status).toBe(200);
    expect(db.prisma.savedView.updateMany.mock.calls[0][0].where).toEqual({ id: "v1", organizationId: "org-a" });
    expect((await DELETE(req("DELETE"), viewCtx)).status).toBe(200);
    expect(audit).not.toHaveBeenCalled();
  });

  it("stops others changing a shared view, but lets an admin delete it with an audit entry", async () => {
    db.prisma.savedView.findFirst.mockResolvedValue(othersShared);
    expect((await PATCH(req("PATCH", { name: "x" }), viewCtx)).status).toBe(403);
    expect((await DELETE(req("DELETE"), viewCtx)).status).toBe(403);
    expect(db.prisma.savedView.deleteMany).not.toHaveBeenCalled();

    auth.role = "admin";
    db.prisma.savedView.deleteMany.mockResolvedValue({ count: 1 });
    expect((await DELETE(req("DELETE"), viewCtx)).status).toBe(200);
    expect(audit.mock.calls[0][0]).toMatchObject({ action: "saved_view.deleted", organizationId: "org-a" });
  });

  it("only editors can turn a private view into a shared one", async () => {
    db.prisma.savedView.findFirst.mockResolvedValue(mine);
    auth.role = "viewer";
    expect((await PATCH(req("PATCH", { shared: true }), viewCtx)).status).toBe(403);
    expect(db.prisma.savedView.updateMany).not.toHaveBeenCalled();
  });

  it("re-checks ids in changed filters against the org", async () => {
    db.prisma.savedView.findFirst.mockResolvedValue(mine);
    db.prisma.facility.findFirst.mockResolvedValue(null);
    expect((await PATCH(req("PATCH", { filters: { facilityId: "facility-of-org-b" } }), viewCtx)).status).toBe(404);
    expect(db.prisma.savedView.updateMany).not.toHaveBeenCalled();
  });
});
