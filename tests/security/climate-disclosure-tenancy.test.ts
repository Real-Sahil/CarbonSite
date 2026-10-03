// @vitest-environment node
/**
 * The climate risk register stays inside the caller's organisation: an id from
 * another org updates or deletes nothing, and reads and writes are always
 * scoped to the org in the URL.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  prisma: {
    climateRisk: { updateMany: vi.fn(), deleteMany: vi.fn(), create: vi.fn(), findMany: vi.fn() },
    climateDisclosure: { findUnique: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => db);
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  requireOrgMember: vi.fn(async () => ({ session: { user: { id: "u1" } }, membership: { role: "admin" } })),
  ROLE_GROUPS: { editor: [], admins: [], dataReaders: [] },
  AuthError: class AuthError extends Error {},
}));

import { DELETE, PATCH } from "@/app/api/orgs/[orgId]/climate-risks/[riskId]/route";
import { GET, POST } from "@/app/api/orgs/[orgId]/climate-risks/route";
import { POST as APPROVE } from "@/app/api/orgs/[orgId]/climate-disclosure/approve/route";

const ctx = { params: Promise.resolve({ orgId: "org-a", riskId: "risk-of-org-b" }) };
const orgCtx = { params: Promise.resolve({ orgId: "org-a" }) };
const risk = {
  kind: "physical_acute", title: "Flooding of the depot", horizon: "medium",
  inherentLikelihood: 3, inherentImpact: 4,
};
const req = (method: string, body?: unknown) =>
  new NextRequest("http://x/api", { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

beforeEach(() => vi.clearAllMocks());

describe("climate risk tenancy", () => {
  it("updates and deletes only inside the org, and answers 404 when nothing matched", async () => {
    db.prisma.climateRisk.updateMany.mockResolvedValue({ count: 0 });
    db.prisma.climateRisk.deleteMany.mockResolvedValue({ count: 0 });
    expect((await PATCH(req("PATCH", risk), ctx)).status).toBe(404);
    expect(db.prisma.climateRisk.updateMany.mock.calls[0][0].where).toEqual({ id: "risk-of-org-b", organizationId: "org-a" });
    expect((await DELETE(req("DELETE"), ctx)).status).toBe(404);
    expect(db.prisma.climateRisk.deleteMany).toHaveBeenCalledWith({ where: { id: "risk-of-org-b", organizationId: "org-a" } });
  });

  it("creates under the org in the URL, whatever organisationId the body carries", async () => {
    db.prisma.climateRisk.create.mockResolvedValue({ id: "r1", kind: "physical_acute", horizon: "medium" });
    const res = await POST(req("POST", { ...risk, organizationId: "org-b" }), orgCtx);
    expect(res.status).toBe(201);
    expect(db.prisma.climateRisk.create.mock.calls[0][0].data.organizationId).toBe("org-a");
  });

  it("lists only the org's own risks", async () => {
    db.prisma.climateRisk.findMany.mockResolvedValue([]);
    await GET(req("GET"), orgCtx);
    expect(db.prisma.climateRisk.findMany.mock.calls[0][0].where).toEqual({ organizationId: "org-a" });
  });

  it("rejects a score outside 1 to 5 and half a residual score", async () => {
    expect((await POST(req("POST", { ...risk, inherentImpact: 6 }), orgCtx)).status).toBe(422);
    expect((await POST(req("POST", { ...risk, residualLikelihood: 2 }), orgCtx)).status).toBe(422);
    expect(db.prisma.climateRisk.create).not.toHaveBeenCalled();
  });

  it("approves only the org's own statement", async () => {
    db.prisma.climateDisclosure.findUnique.mockResolvedValue(null);
    const res = await APPROVE(req("POST", { approvalBody: "Board", approvedOn: "2026-01-01" }), orgCtx);
    expect(res.status).toBe(404);
    expect(db.prisma.climateDisclosure.findUnique.mock.calls[0][0].where).toEqual({ organizationId: "org-a" });
    expect(db.prisma.climateDisclosure.update).not.toHaveBeenCalled();
  });
});
