// @vitest-environment node
/** Site Waste Management Plan: project must be the organisation's own; approval needs a complete plan; editing an approved plan reopens it. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  prisma: {
    siteWastePlan: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    wasteRecord: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => db);
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
const session = vi.hoisted(() => ({
  requireOrgMember: vi.fn(),
  AuthError: class AuthError extends Error {},
  ROLE_GROUPS: { editor: ["admin"], projectManagers: ["project_manager"], dataReaders: ["admin", "viewer"] },
}));
vi.mock("@/lib/auth/session", () => session);
vi.mock("@/lib/security/org-refs", () => ({
  orgRefsError: vi.fn(async (_o: string, r: { projectId?: string | null }) =>
    r.projectId === "proj-of-org-b" ? new Response(JSON.stringify({ code: "NOT_FOUND" }), { status: 404 }) : null),
}));

import { GET, PUT } from "@/app/api/orgs/[orgId]/waste/plans/[projectId]/route";
import { POST as APPROVE } from "@/app/api/orgs/[orgId]/waste/plans/[projectId]/approve/route";

const ctx = (projectId: string) => ({ params: Promise.resolve({ orgId: "org-a", projectId }) });
const req = (method: string, body?: unknown) => new NextRequest("http://x/api", { method, ...(body ? { body: JSON.stringify(body) } : {}) });
const good = { responsiblePerson: "A Smith", principalContractor: "Sisk", targetDiversionPct: 95, actions: "Segregate", nextReviewOn: "2026-12-01", lines: [{ wasteType: "Mixed", forecastTonnes: 10, plannedRoute: "recycle" }] };

beforeEach(() => {
  vi.clearAllMocks();
  session.requireOrgMember.mockResolvedValue({ session: { user: { id: "u1" } }, membership: { role: "admin" } });
  db.prisma.wasteRecord.findMany.mockResolvedValue([]);
});

describe("waste plan", () => {
  it("refuses another organisation's project on read, write and approve", async () => {
    expect((await GET(req("GET"), ctx("proj-of-org-b"))).status).toBe(404);
    expect((await PUT(req("PUT", good), ctx("proj-of-org-b"))).status).toBe(404);
    expect((await APPROVE(req("POST"), ctx("proj-of-org-b"))).status).toBe(404);
    expect(db.prisma.siteWastePlan.create).not.toHaveBeenCalled();
  });

  it("creates a draft plan inside the organisation", async () => {
    db.prisma.siteWastePlan.findFirst.mockResolvedValue(null);
    db.prisma.siteWastePlan.create.mockResolvedValue({ id: "p1", status: "draft", version: 1 });
    expect((await PUT(req("PUT", good), ctx("proj-a"))).status).toBe(201);
    expect(db.prisma.siteWastePlan.create.mock.calls[0][0].data).toMatchObject({ organizationId: "org-a", projectId: "proj-a" });
  });

  it("returns an approved plan to draft as the next version when it is edited", async () => {
    db.prisma.siteWastePlan.findFirst.mockResolvedValue({ id: "p1", status: "approved", version: 2 });
    db.prisma.siteWastePlan.update.mockResolvedValue({ id: "p1", status: "draft", version: 3 });
    await PUT(req("PUT", good), ctx("proj-a"));
    expect(db.prisma.siteWastePlan.update.mock.calls[0][0].data).toMatchObject({ status: "draft", version: 3, approvedAt: null, approvedByUserId: null });
  });

  it("will not approve an incomplete plan", async () => {
    db.prisma.siteWastePlan.findFirst.mockResolvedValue({ id: "p1", status: "draft", version: 1, responsiblePerson: null, lines: [] });
    const res = await APPROVE(req("POST"), ctx("proj-a"));
    expect(res.status).toBe(409);
    expect(db.prisma.siteWastePlan.updateMany).not.toHaveBeenCalled();
  });

  it("refuses a field the form cannot set, such as status", async () => {
    expect((await PUT(req("PUT", { ...good, status: "approved" }), ctx("proj-a"))).status).toBeGreaterThanOrEqual(400);
  });
});
