// @vitest-environment node
/**
 * Material classifications and loads stay inside the caller's organisation:
 * ids a body names must be the org's own, and an id from another org is
 * never updated, received or deleted.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  prisma: {
    site: { findFirst: vi.fn() },
    project: { findFirst: vi.fn() },
    facility: { findFirst: vi.fn() },
    materialClassification: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
    materialMovement: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn(), deleteMany: vi.fn() },
    evidenceFile: { count: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => db);
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/calculation/environmental-metrics", () => ({ syncWasteRecordCalculation: vi.fn(), rebuildEnvironmentalMetricAggregates: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  requireOrgMember: vi.fn(async () => ({ session: { user: { id: "u1" } }, membership: { role: "admin" } })),
  ROLE_GROUPS: { anyMember: [], editor: ["admin"], projectManagers: [] },
  AuthError: class AuthError extends Error {},
}));

import { POST as POST_MOVEMENT } from "@/app/api/orgs/[orgId]/material/movements/route";
import { PATCH as PATCH_MOVEMENT, DELETE as DELETE_MOVEMENT } from "@/app/api/orgs/[orgId]/material/movements/[id]/route";
import { PATCH as PATCH_CLASS, DELETE as DELETE_CLASS } from "@/app/api/orgs/[orgId]/material/classifications/[id]/route";

const ctx = { params: Promise.resolve({ orgId: "org-a", id: "x-of-org-b" }) };
const req = (method: string, body?: unknown) => new NextRequest("http://x/api", { method, body: body ? JSON.stringify(body) : undefined });
beforeEach(() => vi.clearAllMocks());

describe("material tenancy", () => {
  it("planning a load refuses another org's classification before writing", async () => {
    db.prisma.site.findFirst.mockResolvedValue({ id: "s" });
    db.prisma.materialClassification.findFirst.mockResolvedValue(null);
    const res = await POST_MOVEMENT(req("POST", { siteId: "s", classificationId: "c-of-org-b", plannedOn: "2026-09-10", plannedTonnes: 5, destinationName: "X" }), { params: Promise.resolve({ orgId: "org-a" }) });
    expect(res.status).toBe(404);
    expect(db.prisma.materialClassification.findFirst.mock.calls[0][0].where).toEqual({ id: "c-of-org-b", organizationId: "org-a" });
    expect(db.prisma.materialMovement.create).not.toHaveBeenCalled();
  });

  it("a load or classification of another org is 404 and nothing is written", async () => {
    db.prisma.materialMovement.findFirst.mockResolvedValue(null);
    db.prisma.materialClassification.findFirst.mockResolvedValue(null);
    expect((await PATCH_MOVEMENT(req("PATCH", { action: "cancel" }), ctx)).status).toBe(404);
    expect((await PATCH_MOVEMENT(req("PATCH", { action: "receive", receivedOn: "2026-09-11", ticketTonnes: 5 }), ctx)).status).toBe(404);
    expect((await DELETE_MOVEMENT(req("DELETE"), ctx)).status).toBe(404);
    expect((await PATCH_CLASS(req("PATCH", { action: "approve" }), ctx)).status).toBe(404);
    expect((await DELETE_CLASS(req("DELETE"), ctx)).status).toBe(404);
    for (const where of [db.prisma.materialMovement.findFirst.mock.calls[0][0].where, db.prisma.materialClassification.findFirst.mock.calls[0][0].where]) {
      expect(where).toEqual({ id: "x-of-org-b", organizationId: "org-a" });
    }
    expect(db.prisma.materialMovement.update).not.toHaveBeenCalled();
    expect(db.prisma.materialMovement.deleteMany).not.toHaveBeenCalled();
    expect(db.prisma.materialClassification.update).not.toHaveBeenCalled();
    expect(db.prisma.materialClassification.deleteMany).not.toHaveBeenCalled();
  });

  it("evidence ids that are not the org's are refused", async () => {
    db.prisma.materialClassification.findFirst.mockResolvedValue({ id: "c" });
    db.prisma.evidenceFile.count.mockResolvedValue(0);
    const res = await PATCH_CLASS(req("PATCH", { evidenceFileIds: ["f-of-org-b"] }), ctx);
    expect(res.status).toBe(404);
    expect(db.prisma.materialClassification.update).not.toHaveBeenCalled();
  });
});
