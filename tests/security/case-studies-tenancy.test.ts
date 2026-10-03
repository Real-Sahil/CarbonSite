// @vitest-environment node
/**
 * Case studies stay inside the caller's organisation: the contract a body names
 * must be the org's own, and another org's id updates or deletes nothing.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  prisma: {
    contract: { findFirst: vi.fn() },
    evidenceFile: { findFirst: vi.fn() },
    organizationMembership: { findFirst: vi.fn() },
    caseStudy: { create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => db);
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  requireOrgMember: vi.fn(async () => ({ session: { user: { id: "u1" } }, membership: { role: "admin" } })),
  ROLE_GROUPS: { editor: [], dataReaders: [] },
  AuthError: class AuthError extends Error {},
}));

import { DELETE, PATCH } from "@/app/api/orgs/[orgId]/case-studies/[caseStudyId]/route";
import { GET, POST } from "@/app/api/orgs/[orgId]/case-studies/route";

const ctx = { params: Promise.resolve({ orgId: "org-a", caseStudyId: "cs-of-org-b" }) };
const orgCtx = { params: Promise.resolve({ orgId: "org-a" }) };
const req = (method: string, b?: unknown) => new NextRequest("http://x/api", { method, ...(b === undefined ? {} : { body: JSON.stringify(b) }) });

beforeEach(() => vi.clearAllMocks());

describe("case study tenancy", () => {
  it("refuses a contract from another org before writing anything", async () => {
    db.prisma.contract.findFirst.mockResolvedValue(null);
    expect((await POST(req("POST", { title: "Solar units", contractId: "contract-of-org-b" }), orgCtx)).status).toBe(404);
    expect((await PATCH(req("PATCH", { title: "Solar units", contractId: "contract-of-org-b" }), ctx)).status).toBe(404);
    expect(db.prisma.contract.findFirst.mock.calls[0][0].where).toEqual({ id: "contract-of-org-b", organizationId: "org-a" });
    expect(db.prisma.caseStudy.create).not.toHaveBeenCalled();
    expect(db.prisma.caseStudy.updateMany).not.toHaveBeenCalled();
  });

  it("refuses a photo that is another org's evidence file before writing anything", async () => {
    db.prisma.evidenceFile.findFirst.mockResolvedValue(null);
    expect((await POST(req("POST", { title: "Solar units", photoEvidenceFileId: "file-of-org-b" }), orgCtx)).status).toBe(404);
    expect((await PATCH(req("PATCH", { title: "Solar units", photoEvidenceFileId: "file-of-org-b" }), ctx)).status).toBe(404);
    expect(db.prisma.evidenceFile.findFirst.mock.calls[0][0].where).toEqual({ id: "file-of-org-b", organizationId: "org-a" });
    expect(db.prisma.caseStudy.create).not.toHaveBeenCalled();
    expect(db.prisma.caseStudy.updateMany).not.toHaveBeenCalled();
  });

  it("creates under the org in the URL whatever organisationId the body carries", async () => {
    db.prisma.caseStudy.create.mockResolvedValue({ id: "cs1", published: false, contractId: null });
    const res = await POST(req("POST", { title: "Solar units", organizationId: "org-b" }), orgCtx);
    expect(res.status).toBe(201);
    expect(db.prisma.caseStudy.create.mock.calls[0][0].data.organizationId).toBe("org-a");
  });

  it("updates and deletes only inside the org and answers 404 when nothing matched", async () => {
    db.prisma.caseStudy.updateMany.mockResolvedValue({ count: 0 });
    db.prisma.caseStudy.deleteMany.mockResolvedValue({ count: 0 });
    expect((await PATCH(req("PATCH", { title: "Solar units" }), ctx)).status).toBe(404);
    expect(db.prisma.caseStudy.updateMany.mock.calls[0][0].where).toEqual({ id: "cs-of-org-b", organizationId: "org-a" });
    expect((await DELETE(req("DELETE"), ctx)).status).toBe(404);
    expect(db.prisma.caseStudy.deleteMany).toHaveBeenCalledWith({ where: { id: "cs-of-org-b", organizationId: "org-a" } });
  });

  it("lists only the org's own case studies", async () => {
    db.prisma.caseStudy.findMany.mockResolvedValue([]);
    await GET(req("GET"), orgCtx);
    expect(db.prisma.caseStudy.findMany.mock.calls[0][0].where).toEqual({ organizationId: "org-a" });
  });
});
