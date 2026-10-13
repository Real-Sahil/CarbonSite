// @vitest-environment node
/**
 * Supplier invites. The token comes from a CSPRNG rather than a cuid, and a
 * magic-link invite returns no link to the admin: the link goes out by email only.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/orgs/[orgId]/supplier-invites/route";

const db = vi.hoisted(() => ({
  organizationMembership: { findFirst: vi.fn() },
  organization: { findUnique: vi.fn() },
  tenantBranding: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  supplierInvite: { create: vi.fn() },
}));

const mailer = vi.hoisted(() => ({
  sendSupplierInviteEmail: vi.fn(),
  sendSupplierCredentialsEmail: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  requireOrgMember: vi.fn().mockResolvedValue({
    session: { user: { id: "admin-a", name: "Admin A", email: "a@org-a.test" } },
    membership: {},
  }),
  ROLE_GROUPS: { admins: ["admin"] },
  AuthError: class AuthError extends Error {},
}));
vi.mock("@/lib/jobs/dispatch", () => ({ dispatchNotification: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/notifications/email", () => ({ resolveEmailLogoUrl: vi.fn() }));
vi.mock("@/lib/auth/temporary-password", () => ({
  generateTemporaryPassword: vi.fn(() => "unused"),
  hashTemporaryPassword: vi.fn(async () => "unused-hash"),
}));
vi.mock("@/workers/supplier-invite-email", () => mailer);

const ctx = { params: Promise.resolve({ orgId: "org-a" }) };

beforeEach(() => {
  db.organizationMembership.findFirst.mockResolvedValue(null);
  db.organization.findUnique.mockResolvedValue({ name: "Org A" });
  db.tenantBranding.findUnique.mockResolvedValue(null);
  db.user.findUnique.mockResolvedValue(null);
  db.supplierInvite.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "si-1",
    ...data,
  }));
});

describe("POST /api/orgs/[orgId]/supplier-invites (magic link)", () => {
  it("returns no link and emails it with a random token", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/orgs/org-a/supplier-invites", {
        method: "POST",
        body: JSON.stringify({ email: "sup@example.test", inviteMethod: "magic-link" }),
      }),
      ctx,
    );

    expect(res.status).toBe(201);
    expect(await res.json()).not.toHaveProperty("inviteUrl");

    const { token } = db.supplierInvite.create.mock.calls[0][0].data;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const { inviteUrl } = mailer.sendSupplierInviteEmail.mock.calls[0][0];
    expect(inviteUrl.endsWith(`/supplier-invite/${token}`)).toBe(true);
  });
});
