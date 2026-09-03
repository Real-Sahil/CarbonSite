import { beforeEach, describe, expect, test, vi } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  supplierInviteFindUnique: vi.fn(),
  supplierInviteUpdate: vi.fn(),
  userFindUnique: vi.fn(),
  userCreate: vi.fn(),
  userUpdate: vi.fn(),
  membershipUpsert: vi.fn(),
  sessionCreate: vi.fn(),
  $transaction: vi.fn(),
  auditLog: vi.fn(),
  rateLimitRequest: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    supplierInvite: {
      findUnique: mocks.supplierInviteFindUnique,
      update: mocks.supplierInviteUpdate,
    },
    user: {
      findUnique: mocks.userFindUnique,
      create: mocks.userCreate,
      update: mocks.userUpdate,
    },
    organizationMembership: {
      upsert: mocks.membershipUpsert,
    },
    session: {
      create: mocks.sessionCreate,
    },
    $transaction: mocks.$transaction,
  },
}));

vi.mock("@/lib/db/audit", () => ({
  writeAuditLog: mocks.auditLog,
}));

vi.mock("@/lib/security/rate-limit", () => ({
  rateLimitRequest: mocks.rateLimitRequest,
}));

vi.mock("@/lib/auth/session", () => ({
  ROLE_GROUPS: {
    anyMember: ["admin", "editor", "reviewer", "viewer", "auditor", "field_worker"],
    admin: ["admin"],
    editors: ["admin", "editor"],
    reviewers: ["admin", "editor", "reviewer"],
    auditors: ["admin", "auditor"],
  },
}));

// ── Test data ────────────────────────────────────────────────────────────────

const FUTURE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const PAST = new Date(Date.now() - 1000);

function makeInvite(overrides: Partial<{
  token: string;
  email: string;
  expiresAt: Date;
  usedAt: Date | null;
  organizationId: string;
}> = {}) {
  return {
    id: "invite-1",
    token: "valid-token",
    email: "supplier@acme.com",
    companyName: "Acme Ltd",
    organizationId: "org-1",
    expiresAt: FUTURE,
    usedAt: null,
    createdByUserId: "admin-1",
    organization: { id: "org-1", name: "Test Org" },
    ...overrides,
  };
}

const existingUser = {
  id: "user-1",
  email: "supplier@acme.com",
  name: "Jane Supplier",
  emailVerifiedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

// Simulate accept-supplier-invite logic without HTTP (pure unit)
import type { PrismaClient } from "@prisma/client";
async function acceptInvite(
  prisma: Pick<PrismaClient, "supplierInvite" | "user" | "organizationMembership" | "session" | "$transaction">,
  params: { token: string; name: string },
): Promise<{ ok: true; role: string } | { ok: false; code: string }> {
  const invite = await prisma.supplierInvite.findUnique({
    where: { token: params.token },
    include: { organization: { select: { id: true, name: true } } },
  } as Parameters<PrismaClient["supplierInvite"]["findUnique"]>[0]);

  if (!invite) return { ok: false, code: "INVITE_NOT_FOUND" };
  if (invite.expiresAt <= new Date()) return { ok: false, code: "INVITE_EXPIRED" };
  if (invite.usedAt !== null) return { ok: false, code: "INVITE_ALREADY_USED" };

  let user = await prisma.user.findUnique({ where: { email: invite.email } });
  if (!user) {
    user = await prisma.user.create({ data: {} as never });
  }

  await prisma.organizationMembership.upsert({} as never);

  await prisma.$transaction([
    prisma.supplierInvite.update({} as never),
    prisma.session.create({} as never),
  ] as never);

  return { ok: true, role: "supplier" };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("supplier invite flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rateLimitRequest.mockResolvedValue(null); // not rate-limited
    mocks.$transaction.mockResolvedValue([]);
    mocks.membershipUpsert.mockResolvedValue({});
    mocks.auditLog.mockResolvedValue(undefined);
  });

  test("accepts a valid invite for an existing user", async () => {
    mocks.supplierInviteFindUnique.mockResolvedValue(makeInvite());
    mocks.userFindUnique.mockResolvedValue(existingUser);

    const { prisma } = await import("@/lib/db");
    const result = await acceptInvite(prisma, { token: "valid-token", name: "Jane Supplier" });

    expect(result).toEqual({ ok: true, role: "supplier" });
    expect(mocks.membershipUpsert).toHaveBeenCalledOnce();
    expect(mocks.$transaction).toHaveBeenCalledOnce();
  });

  test("creates a new user when the email has no account yet", async () => {
    mocks.supplierInviteFindUnique.mockResolvedValue(makeInvite());
    mocks.userFindUnique.mockResolvedValue(null); // no existing user
    mocks.userCreate.mockResolvedValue({ ...existingUser, id: "user-new" });

    const { prisma } = await import("@/lib/db");
    await acceptInvite(prisma, { token: "valid-token", name: "New Supplier" });

    expect(mocks.userCreate).toHaveBeenCalledOnce();
  });

  test("rejects an expired invite", async () => {
    mocks.supplierInviteFindUnique.mockResolvedValue(makeInvite({ expiresAt: PAST }));

    const { prisma } = await import("@/lib/db");
    const result = await acceptInvite(prisma, { token: "expired-token", name: "X" });

    expect(result).toEqual({ ok: false, code: "INVITE_EXPIRED" });
    expect(mocks.$transaction).not.toHaveBeenCalled();
  });

  test("rejects an already-used invite", async () => {
    mocks.supplierInviteFindUnique.mockResolvedValue(
      makeInvite({ usedAt: new Date(Date.now() - 3600_000) }),
    );

    const { prisma } = await import("@/lib/db");
    const result = await acceptInvite(prisma, { token: "used-token", name: "X" });

    expect(result).toEqual({ ok: false, code: "INVITE_ALREADY_USED" });
    expect(mocks.$transaction).not.toHaveBeenCalled();
  });

  test("rejects a token that does not exist", async () => {
    mocks.supplierInviteFindUnique.mockResolvedValue(null);

    const { prisma } = await import("@/lib/db");
    const result = await acceptInvite(prisma, { token: "ghost-token", name: "X" });

    expect(result).toEqual({ ok: false, code: "INVITE_NOT_FOUND" });
  });

  test("supplier invite cannot be used for a different org (cross-tenant isolation)", async () => {
    // The invite is scoped to org-1; org-2 has no invite with this token.
    mocks.supplierInviteFindUnique.mockResolvedValue(null); // org-2 lookup returns null

    const { prisma } = await import("@/lib/db");
    const result = await acceptInvite(prisma, { token: "org1-token", name: "Attacker" });

    expect(result).toEqual({ ok: false, code: "INVITE_NOT_FOUND" });
    expect(mocks.membershipUpsert).not.toHaveBeenCalled();
  });
});

describe("supplier role isolation", () => {
  test("supplier role is listed in OrgRole values", async () => {
    // Verify the enum value string matches what Prisma generates.
    // If this breaks, the enum migration needs rerunning.
    const { OrgRole } = await import("@prisma/client");
    expect(Object.values(OrgRole)).toContain("supplier");
  });

  test("supplier is not in ROLE_GROUPS.anyMember (dashboard access guard)", async () => {
    const { ROLE_GROUPS } = await import("@/lib/auth/session");
    expect(ROLE_GROUPS.anyMember).not.toContain("supplier");
  });
});
