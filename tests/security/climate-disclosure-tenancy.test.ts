// @vitest-environment node
/**
 * The climate disclosure stays inside the caller's organisation: it is read,
 * written and approved only for the org in the URL, whatever the body says.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  prisma: {
    climateDisclosure: { findUnique: vi.fn(), update: vi.fn(), upsert: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => db);
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  requireOrgMember: vi.fn(async () => ({ session: { user: { id: "u1" } }, membership: { role: "admin" } })),
  ROLE_GROUPS: { editor: [], admins: [], dataReaders: [] },
  AuthError: class AuthError extends Error {},
}));

import { PUT } from "@/app/api/orgs/[orgId]/climate-disclosure/route";
import { POST as APPROVE } from "@/app/api/orgs/[orgId]/climate-disclosure/approve/route";

const orgCtx = { params: Promise.resolve({ orgId: "org-a" }) };
const req = (method: string, body?: unknown) =>
  new NextRequest("http://x/api", { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

beforeEach(() => vi.clearAllMocks());

describe("climate disclosure tenancy", () => {
  it("saves under the org in the URL, whatever organisationId the body carries", async () => {
    db.prisma.climateDisclosure.findUnique.mockResolvedValue(null);
    db.prisma.climateDisclosure.upsert.mockResolvedValue({ id: "d1" });
    const res = await PUT(req("PUT", { governanceBoard: "We review it quarterly.", organizationId: "org-b" }), orgCtx);
    expect(res.status).toBe(200);
    const call = db.prisma.climateDisclosure.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ organizationId: "org-a" });
    expect(call.create.organizationId).toBe("org-a");
    expect(JSON.stringify(call.create.sections)).not.toContain("org-b");
  });

  it("returns an approved statement to draft when it is edited", async () => {
    db.prisma.climateDisclosure.findUnique.mockResolvedValue({ id: "d1", status: "approved" });
    db.prisma.climateDisclosure.upsert.mockResolvedValue({ id: "d1" });
    const res = await PUT(req("PUT", { governanceBoard: "Changed." }), orgCtx);
    expect((await res.json()).reopened).toBe(true);
    expect(db.prisma.climateDisclosure.upsert.mock.calls[0][0].update).toMatchObject({ status: "draft", approvedAt: null, approvedByUserId: null });
  });

  it("approves only the org's own statement", async () => {
    db.prisma.climateDisclosure.findUnique.mockResolvedValue(null);
    const res = await APPROVE(req("POST", { approvalBody: "Board", approvedOn: "2026-01-01" }), orgCtx);
    expect(res.status).toBe(404);
    expect(db.prisma.climateDisclosure.findUnique.mock.calls[0][0].where).toEqual({ organizationId: "org-a" });
    expect(db.prisma.climateDisclosure.update).not.toHaveBeenCalled();
  });

  it("refuses an approval date in the future", async () => {
    const res = await APPROVE(req("POST", { approvalBody: "Board", approvedOn: "2999-01-01" }), orgCtx);
    expect(res.status).toBe(400);
    expect(db.prisma.climateDisclosure.update).not.toHaveBeenCalled();
  });
});
