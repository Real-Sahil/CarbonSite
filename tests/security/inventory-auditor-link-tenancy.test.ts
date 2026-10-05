// @vitest-environment node
/**
 * Verifier links to the emissions inventory: a link is made only for the organisation's own
 * snapshot and engagement, the roles that can issue one are limited, a link opens nothing once
 * revoked, expired or when its snapshot is not in the organisation, and the stored token is a hash.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  prisma: {
    publishedSnapshot: { findFirst: vi.fn() },
    assuranceEngagement: { findFirst: vi.fn() },
    inventoryAuditorAccess: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => db);
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
const session = vi.hoisted(() => ({ requireOrgMember: vi.fn(), AuthError: class AuthError extends Error {} }));
vi.mock("@/lib/auth/session", () => session);

import { POST } from "@/app/api/orgs/[orgId]/assurance/auditor-links/route";
import { DELETE } from "@/app/api/orgs/[orgId]/assurance/auditor-links/[id]/route";
import { resolveInventoryAuditorToken, LINK_ROLES } from "@/lib/assurance/auditor-link";
import { hashToken } from "@/lib/management-systems/auditor-access";

const ctx = { params: Promise.resolve({ orgId: "org-a" }) };
const post = (body: unknown) => new NextRequest("http://x/api", { method: "POST", body: JSON.stringify(body) });
const good = { snapshotId: "snap-a", name: "V. Erifier", days: 30 };

beforeEach(() => {
  vi.clearAllMocks();
  session.requireOrgMember.mockResolvedValue({ session: { user: { id: "u1" } }, membership: { role: "admin" } });
});

describe("inventory verifier links", () => {
  it("is limited to admins and sustainability directors", () => {
    expect([...LINK_ROLES]).toEqual(["admin", "sustainability_director"]);
  });

  it("refuses a snapshot from another organisation and creates nothing", async () => {
    db.prisma.publishedSnapshot.findFirst.mockResolvedValue(null);
    const res = await POST(post({ ...good, snapshotId: "snap-of-org-b" }), ctx);
    expect(res.status).toBe(404);
    expect(db.prisma.publishedSnapshot.findFirst.mock.calls[0][0].where).toEqual({ id: "snap-of-org-b", organizationId: "org-a" });
    expect(db.prisma.inventoryAuditorAccess.create).not.toHaveBeenCalled();
  });

  it("refuses an engagement from another organisation", async () => {
    db.prisma.publishedSnapshot.findFirst.mockResolvedValue({ id: "snap-a" });
    db.prisma.assuranceEngagement.findFirst.mockResolvedValue(null);
    const res = await POST(post({ ...good, engagementId: "eng-of-org-b" }), ctx);
    expect(res.status).toBe(404);
    expect(db.prisma.assuranceEngagement.findFirst.mock.calls[0][0].where).toEqual({ id: "eng-of-org-b", organizationId: "org-a" });
    expect(db.prisma.inventoryAuditorAccess.create).not.toHaveBeenCalled();
  });

  it("stores only the hash of the token it returns, and caps the lifetime", async () => {
    db.prisma.publishedSnapshot.findFirst.mockResolvedValue({ id: "snap-a" });
    db.prisma.inventoryAuditorAccess.create.mockImplementation(async ({ data }) => ({ id: "l1", ...data }));
    expect((await POST(post({ ...good, days: 91 }), ctx)).status).toBe(422);
    const res = await POST(post(good), ctx);
    expect(res.status).toBe(201);
    const { url } = (await res.json()) as { url: string };
    const token = url.split("/inventory-audit/")[1];
    const data = db.prisma.inventoryAuditorAccess.create.mock.calls[0][0].data;
    expect(data.tokenHash).toBe(hashToken(token));
    expect(JSON.stringify(data)).not.toContain(token);
    expect(data.organizationId).toBe("org-a");
  });

  it("withdraws only a link of the caller's organisation", async () => {
    db.prisma.inventoryAuditorAccess.findFirst.mockResolvedValue(null);
    const res = await DELETE(new NextRequest("http://x/api", { method: "DELETE" }), { params: Promise.resolve({ orgId: "org-a", id: "link-of-org-b" }) });
    expect(res.status).toBe(404);
    expect(db.prisma.inventoryAuditorAccess.findFirst.mock.calls[0][0].where).toEqual({ id: "link-of-org-b", organizationId: "org-a" });
    expect(db.prisma.inventoryAuditorAccess.update).not.toHaveBeenCalled();
  });

  describe("opening a link", () => {
    const token = "a".repeat(43);
    const base = { id: "l1", organizationId: "org-a", snapshotId: "snap-a", revokedAt: null, expiresAt: new Date(Date.now() + 86_400_000) };
    it("rejects a malformed token without touching the database", async () => {
      expect(await resolveInventoryAuditorToken("short")).toBeNull();
      expect(db.prisma.inventoryAuditorAccess.findUnique).not.toHaveBeenCalled();
    });
    it("rejects revoked and expired links", async () => {
      db.prisma.inventoryAuditorAccess.findUnique.mockResolvedValue({ ...base, revokedAt: new Date() });
      expect(await resolveInventoryAuditorToken(token)).toBeNull();
      db.prisma.inventoryAuditorAccess.findUnique.mockResolvedValue({ ...base, expiresAt: new Date(Date.now() - 1000) });
      expect(await resolveInventoryAuditorToken(token)).toBeNull();
    });
    it("rejects a link whose snapshot is not in the link's organisation", async () => {
      db.prisma.inventoryAuditorAccess.findUnique.mockResolvedValue(base);
      db.prisma.publishedSnapshot.findFirst.mockResolvedValue(null);
      expect(await resolveInventoryAuditorToken(token)).toBeNull();
      expect(db.prisma.publishedSnapshot.findFirst.mock.calls[0][0].where).toEqual({ id: "snap-a", organizationId: "org-a" });
    });
    it("looks the link up by hash, never by the raw token", async () => {
      db.prisma.inventoryAuditorAccess.findUnique.mockResolvedValue(null);
      await resolveInventoryAuditorToken(token);
      expect(db.prisma.inventoryAuditorAccess.findUnique).toHaveBeenCalledWith({ where: { tokenHash: hashToken(token) } });
    });
  });
});
