// @vitest-environment node
/**
 * Supplier invites. The token comes from a CSPRNG rather than a cuid, and a
 * magic-link invite returns no link to the admin: the link goes out by email only.
 * A credentials invite emails its password before anything is written, so a failed
 * send leaves no account behind that the admin cannot re-invite or resend.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/orgs/[orgId]/supplier-invites/route";

const { models, db, audit, mailer } = vi.hoisted(() => {
  const models = {
    organizationMembership: { findFirst: vi.fn(), create: vi.fn() },
    organization: { findUnique: vi.fn() },
    tenantBranding: { findUnique: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn() },
    account: { create: vi.fn() },
    supplierInvite: { create: vi.fn() },
  };
  return {
    models,
    db: {
      ...models,
      $transaction: vi.fn(async (fn: (tx: typeof models) => Promise<unknown>) => fn(models)),
    },
    audit: vi.fn(),
    mailer: { sendSupplierInviteEmail: vi.fn(), sendSupplierCredentialsEmail: vi.fn() },
  };
});

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: audit }));
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
  generateTemporaryPassword: vi.fn(() => "temp-pw"),
  hashTemporaryPassword: vi.fn(async (password: string) => `hash(${password})`),
}));
vi.mock("@/workers/supplier-invite-email", () => mailer);

const ctx = { params: Promise.resolve({ orgId: "org-a" }) };

function post(body: Record<string, unknown>) {
  return POST(
    new NextRequest("http://localhost/api/orgs/org-a/supplier-invites", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    ctx,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  models.organizationMembership.findFirst.mockResolvedValue(null);
  models.organization.findUnique.mockResolvedValue({ name: "Org A" });
  models.tenantBranding.findUnique.mockResolvedValue(null);
  models.user.findUnique.mockResolvedValue(null);
  models.user.create.mockResolvedValue({ id: "sup-user-1" });
  models.supplierInvite.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "si-1",
    ...data,
  }));
});

describe("POST /api/orgs/[orgId]/supplier-invites (magic link)", () => {
  it("returns no link and emails it with a random token", async () => {
    const res = await post({ email: "sup@example.test", inviteMethod: "magic-link" });

    expect(res.status).toBe(201);
    expect(await res.json()).not.toHaveProperty("inviteUrl");

    const { token } = models.supplierInvite.create.mock.calls[0][0].data;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const { inviteUrl } = mailer.sendSupplierInviteEmail.mock.calls[0][0];
    expect(inviteUrl.endsWith(`/supplier-invite/${token}`)).toBe(true);
  });

  it("keeps the invite when the link email fails, and reports it", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    mailer.sendSupplierInviteEmail.mockRejectedValueOnce(new Error("resend 500"));

    const res = await post({ email: "sup@example.test", inviteMethod: "magic-link" });

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ emailDelivery: "email_failed" });
    expect(models.supplierInvite.create).toHaveBeenCalledTimes(1);
    errorLog.mockRestore();
  });
});

describe("POST /api/orgs/[orgId]/supplier-invites (credentials)", () => {
  it("emails the password before anything is written, then saves account and invite together", async () => {
    const res = await post({ email: "sup@example.test", inviteMethod: "credentials" });

    expect(res.status).toBe(201);
    expect(mailer.sendSupplierInviteEmail).not.toHaveBeenCalled();
    expect(mailer.sendSupplierCredentialsEmail.mock.calls[0][0]).toMatchObject({ temporaryPassword: "temp-pw" });
    expect(mailer.sendSupplierCredentialsEmail.mock.invocationCallOrder[0]).toBeLessThan(
      db.$transaction.mock.invocationCallOrder[0],
    );

    expect(models.account.create.mock.calls[0][0].data.password).toBe("hash(temp-pw)");
    const invite = models.supplierInvite.create.mock.calls[0][0].data;
    expect(invite.usedByUserId).toBe("sup-user-1");
    expect(invite.usedAt).toBeInstanceOf(Date);
    expect(audit).toHaveBeenCalledTimes(1);
  });

  it("writes nothing when the password email fails", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    mailer.sendSupplierCredentialsEmail.mockRejectedValueOnce(new Error("resend 500"));

    const res = await post({ email: "sup@example.test", inviteMethod: "credentials" });

    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ code: "EMAIL_NOT_SENT" });
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(models.user.create).not.toHaveBeenCalled();
    expect(models.account.create).not.toHaveBeenCalled();
    expect(models.supplierInvite.create).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
    errorLog.mockRestore();
  });
});
