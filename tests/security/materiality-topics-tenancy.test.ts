// @vitest-environment node
/**
 * Materiality topics stay inside the caller's organisation, and an approved
 * assessment is not edited in place.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  prisma: {
    materialityAssessment: { findFirst: vi.fn() },
    materialityTopic: { updateMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => db);
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  requireOrgMember: vi.fn(async () => ({ session: { user: { id: "u1" } }, membership: { role: "admin" } })),
  ROLE_GROUPS: { editor: [], dataReaders: [] },
  AuthError: class AuthError extends Error {},
}));

import { DELETE, PATCH } from "@/app/api/orgs/[orgId]/materiality/[assessmentId]/topics/[topicId]/route";
import { POST as STARTER } from "@/app/api/orgs/[orgId]/materiality/[assessmentId]/starter-topics/route";

const ctx = { params: Promise.resolve({ orgId: "org-a", assessmentId: "as-1", topicId: "topic-of-org-b" }) };
const asCtx = { params: Promise.resolve({ orgId: "org-a", assessmentId: "as-1" }) };
const body = { topicName: "Water", esrsCode: "E3", iroType: "risk", impactScore: 2, financialScore: 4, rationale: null };
const req = (method: string, b?: unknown) => new NextRequest("http://x/api", { method, ...(b === undefined ? {} : { body: JSON.stringify(b) }) });

beforeEach(() => {
  vi.clearAllMocks();
  db.prisma.materialityAssessment.findFirst.mockResolvedValue({ status: "draft", topics: [] });
});

describe("materiality topic tenancy", () => {
  it("updates and deletes only inside the org and assessment, and answers 404 when nothing matched", async () => {
    db.prisma.materialityTopic.updateMany.mockResolvedValue({ count: 0 });
    db.prisma.materialityTopic.deleteMany.mockResolvedValue({ count: 0 });
    expect((await PATCH(req("PATCH", body), ctx)).status).toBe(404);
    expect(db.prisma.materialityTopic.updateMany.mock.calls[0][0].where).toEqual({ id: "topic-of-org-b", assessmentId: "as-1", organizationId: "org-a" });
    expect((await DELETE(req("DELETE"), ctx)).status).toBe(404);
    expect(db.prisma.materialityTopic.deleteMany).toHaveBeenCalledWith({ where: { id: "topic-of-org-b", assessmentId: "as-1", organizationId: "org-a" } });
  });

  it("looks the assessment up inside the org", async () => {
    db.prisma.materialityAssessment.findFirst.mockResolvedValue(null);
    expect((await PATCH(req("PATCH", body), ctx)).status).toBe(404);
    expect(db.prisma.materialityAssessment.findFirst.mock.calls[0][0].where).toEqual({ id: "as-1", organizationId: "org-a" });
    expect(db.prisma.materialityTopic.updateMany).not.toHaveBeenCalled();
  });

  it("derives materiality from the scores unless a person overrides it", async () => {
    db.prisma.materialityTopic.updateMany.mockResolvedValue({ count: 1 });
    await PATCH(req("PATCH", body), ctx);
    expect(db.prisma.materialityTopic.updateMany.mock.calls[0][0].data).toMatchObject({ isMaterial: true, doubleMaterialityScore: 4 });
    await PATCH(req("PATCH", { ...body, isMaterial: false }), ctx);
    expect(db.prisma.materialityTopic.updateMany.mock.calls[1][0].data.isMaterial).toBe(false);
  });

  it("refuses to change the topics of an approved assessment", async () => {
    db.prisma.materialityAssessment.findFirst.mockResolvedValue({ status: "approved", topics: [] });
    for (const res of [await PATCH(req("PATCH", body), ctx), await DELETE(req("DELETE"), ctx), await STARTER(req("POST"), asCtx)]) {
      expect(res.status).toBe(409);
    }
    expect(db.prisma.materialityTopic.updateMany).not.toHaveBeenCalled();
    expect(db.prisma.materialityTopic.createMany).not.toHaveBeenCalled();
  });

  it("adds only the starter topics the assessment lacks, under the org", async () => {
    db.prisma.materialityAssessment.findFirst.mockResolvedValue({ status: "draft", topics: [{ topicName: "Energy" }] });
    const res = await STARTER(req("POST"), asCtx);
    expect(res.status).toBe(201);
    const data = db.prisma.materialityTopic.createMany.mock.calls[0][0].data;
    expect(data.every((t: { organizationId: string }) => t.organizationId === "org-a")).toBe(true);
    expect(data.some((t: { topicName: string }) => t.topicName === "Energy")).toBe(false);
  });
});
