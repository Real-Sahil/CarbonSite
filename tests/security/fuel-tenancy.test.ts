// @vitest-environment node
/**
 * Fuel records stay inside the caller's organisation: a store, machine, site or
 * evidence file from another org is refused before anything is written, and an
 * entry id from another org deletes nothing.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  prisma: {
    site: { findFirst: vi.fn() },
    plantAsset: { findFirst: vi.fn() },
    evidenceFile: { findFirst: vi.fn() },
    fuelStore: { findFirst: vi.fn(), create: vi.fn() },
    fuelDelivery: { create: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
    fuelIssue: { create: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
    fuelDip: { create: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => db);
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  requireOrgMember: vi.fn(async () => ({ session: { user: { id: "u1" } }, membership: { role: "admin" } })),
  ROLE_GROUPS: { anyMember: [], editor: ["admin"], projectManagers: [] },
  AuthError: class AuthError extends Error {},
}));

import { DELETE, POST } from "@/app/api/orgs/[orgId]/fuel/entries/route";
import { POST as POST_STORE } from "@/app/api/orgs/[orgId]/fuel/stores/route";

const ctx = { params: Promise.resolve({ orgId: "org-a" }) };
const post = (body: unknown) => new NextRequest("http://x/api", { method: "POST", body: JSON.stringify(body) });
const entry = { kind: "issue", storeId: "store-b", on: "2026-09-01", litres: 100, plantAssetId: "asset-b" };

beforeEach(() => vi.clearAllMocks());

describe("fuel tenancy", () => {
  it("refuses a store from another org", async () => {
    db.prisma.fuelStore.findFirst.mockResolvedValue(null);
    const res = await POST(post(entry), ctx);
    expect(res.status).toBe(404);
    expect(db.prisma.fuelStore.findFirst.mock.calls[0][0].where).toEqual({ id: "store-b", organizationId: "org-a" });
    expect(db.prisma.fuelIssue.create).not.toHaveBeenCalled();
  });

  it("refuses a machine from another org", async () => {
    db.prisma.fuelStore.findFirst.mockResolvedValue({ id: "store-a", active: true });
    db.prisma.plantAsset.findFirst.mockResolvedValue(null);
    const res = await POST(post(entry), ctx);
    expect(res.status).toBe(404);
    expect(db.prisma.plantAsset.findFirst.mock.calls[0][0].where).toEqual({ id: "asset-b", organizationId: "org-a" });
    expect(db.prisma.fuelIssue.create).not.toHaveBeenCalled();
  });

  it("refuses a delivery ticket from another org", async () => {
    db.prisma.fuelStore.findFirst.mockResolvedValue({ id: "store-a", active: true });
    db.prisma.evidenceFile.findFirst.mockResolvedValue(null);
    const res = await POST(post({ kind: "delivery", storeId: "store-a", on: "2026-09-01", litres: 500, fuelType: "diesel", evidenceFileId: "file-b" }), ctx);
    expect(res.status).toBe(404);
    expect(db.prisma.fuelDelivery.create).not.toHaveBeenCalled();
  });

  it("refuses a site from another org when adding a store", async () => {
    db.prisma.site.findFirst.mockResolvedValue(null);
    const res = await POST_STORE(post({ name: "B1", kind: "bowser", capacityLitres: 2000, siteId: "site-b" }), ctx);
    expect(res.status).toBe(404);
    expect(db.prisma.fuelStore.create).not.toHaveBeenCalled();
  });

  it("refuses an issue that names no machine or vehicle", async () => {
    const res = await POST(post({ kind: "issue", storeId: "s", on: "2026-09-01", litres: 10 }), ctx);
    expect(res.status).toBe(422);
  });

  it("deletes only inside the org", async () => {
    db.prisma.fuelDelivery.findFirst.mockResolvedValue(null);
    const res = await DELETE(new NextRequest("http://x/api?kind=delivery&id=d-of-org-b", { method: "DELETE" }), ctx);
    expect(res.status).toBe(404);
    expect(db.prisma.fuelDelivery.findFirst.mock.calls[0][0].where).toEqual({ id: "d-of-org-b", organizationId: "org-a" });
    expect(db.prisma.fuelDelivery.delete).not.toHaveBeenCalled();
  });
});
