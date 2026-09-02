import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authGetSession: vi.fn(),
  membershipFindUnique: vi.fn(),
  sessionFindUnique: vi.fn(),
  accountFindFirst: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("../index", () => ({
  auth: {
    api: {
      getSession: mocks.authGetSession,
    },
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    organizationMembership: {
      findUnique: mocks.membershipFindUnique,
    },
    session: {
      findUnique: mocks.sessionFindUnique,
    },
    account: {
      findFirst: mocks.accountFindFirst,
    },
  },
}));

import { AuthError, ROLE_GROUPS, requireOrgMember } from "../session";

const session = {
  session: {
    createdAt: new Date("2026-06-08T10:00:00.000Z"),
    expiresAt: new Date("2026-06-08T11:00:00.000Z"),
    id: "session-1",
    token: "token-1",
    updatedAt: new Date("2026-06-08T10:00:00.000Z"),
    userId: "user-1",
  },
  user: {
    createdAt: new Date("2026-06-08T10:00:00.000Z"),
    email: "site.manager@example.test",
    emailVerified: true,
    id: "user-1",
    image: null,
    name: "Site Manager",
    updatedAt: new Date("2026-06-08T10:00:00.000Z"),
  },
};

describe("requireOrgMember", () => {
  beforeEach(() => {
    mocks.authGetSession.mockReset();
    mocks.membershipFindUnique.mockReset();
    mocks.sessionFindUnique.mockReset();
    mocks.accountFindFirst.mockReset();
    mocks.authGetSession.mockResolvedValue(session);
    // Default: account has already changed password (non-null passwordChangedAt)
    mocks.accountFindFirst.mockResolvedValue({ passwordChangedAt: new Date("2026-01-01") });
  });

  test("queries membership by the requested organisation and current user", async () => {
    const membership = {
      id: "membership-1",
      organizationId: "org-1",
      role: "editor",
      userId: "user-1",
    };
    mocks.membershipFindUnique.mockResolvedValue(membership);

    const result = await requireOrgMember("org-1", "admin", "editor");

    expect(result.membership).toBe(membership);
    expect(mocks.membershipFindUnique).toHaveBeenCalledWith({
      where: {
        organizationId_userId: {
          organizationId: "org-1",
          userId: "user-1",
        },
      },
    });
  });

  test("rejects users without membership in the requested organisation", async () => {
    mocks.membershipFindUnique.mockResolvedValue(null);

    await expect(requireOrgMember("org-2", "viewer")).rejects.toMatchObject({
      code: "NOT_MEMBER",
      status: 403,
    } satisfies Partial<AuthError>);
  });

  test("rejects members without an allowed role", async () => {
    mocks.membershipFindUnique.mockResolvedValue({
      id: "membership-2",
      organizationId: "org-1",
      role: "viewer",
      userId: "user-1",
    });

    await expect(requireOrgMember("org-1", "admin")).rejects.toMatchObject({
      code: "INSUFFICIENT_ROLE",
      status: 403,
    } satisfies Partial<AuthError>);
  });

  test("allows access when no roles are specified (any member)", async () => {
    mocks.membershipFindUnique.mockResolvedValue({
      id: "membership-3",
      organizationId: "org-1",
      role: "viewer",
      userId: "user-1",
    });

    await expect(requireOrgMember("org-1")).resolves.toBeDefined();
  });
});

describe("ROLE_GROUPS", () => {
  beforeEach(() => {
    mocks.authGetSession.mockReset();
    mocks.membershipFindUnique.mockReset();
    mocks.sessionFindUnique.mockReset();
    mocks.accountFindFirst.mockReset();
    mocks.authGetSession.mockResolvedValue(session);
    mocks.accountFindFirst.mockResolvedValue({ passwordChangedAt: new Date("2026-01-01") });
  });

  const makeMembership = (role: string) => ({
    id: "m-1",
    organizationId: "org-1",
    role,
    userId: "user-1",
  });

  // ROLE_GROUPS.admins
  test("admins: allows admin", async () => {
    mocks.membershipFindUnique.mockResolvedValue(makeMembership("admin"));
    await expect(requireOrgMember("org-1", ...ROLE_GROUPS.admins)).resolves.toBeDefined();
  });

  test("admins: rejects editor", async () => {
    mocks.membershipFindUnique.mockResolvedValue(makeMembership("editor"));
    await expect(requireOrgMember("org-1", ...ROLE_GROUPS.admins)).rejects.toMatchObject({
      code: "INSUFFICIENT_ROLE",
    });
  });

  // ROLE_GROUPS.sustainability
  test("sustainability: allows admin, sustainability_director, sustainability_manager, editor", async () => {
    for (const role of ROLE_GROUPS.sustainability) {
      mocks.membershipFindUnique.mockResolvedValue(makeMembership(role));
      await expect(requireOrgMember("org-1", ...ROLE_GROUPS.sustainability)).resolves.toBeDefined();
    }
  });

  test("sustainability: rejects viewer", async () => {
    mocks.membershipFindUnique.mockResolvedValue(makeMembership("viewer"));
    await expect(requireOrgMember("org-1", ...ROLE_GROUPS.sustainability)).rejects.toMatchObject({
      code: "INSUFFICIENT_ROLE",
    });
  });

  // ROLE_GROUPS.contractManagers
  test("contractManagers: allows admin, sustainability_director, contract_manager", async () => {
    for (const role of ROLE_GROUPS.contractManagers) {
      mocks.membershipFindUnique.mockResolvedValue(makeMembership(role));
      await expect(requireOrgMember("org-1", ...ROLE_GROUPS.contractManagers)).resolves.toBeDefined();
    }
  });

  test("contractManagers: rejects editor", async () => {
    mocks.membershipFindUnique.mockResolvedValue(makeMembership("editor"));
    await expect(requireOrgMember("org-1", ...ROLE_GROUPS.contractManagers)).rejects.toMatchObject({
      code: "INSUFFICIENT_ROLE",
    });
  });

  // ROLE_GROUPS.reviewers
  test("reviewers: allows admin, sustainability_director, sustainability_manager, reviewer", async () => {
    for (const role of ROLE_GROUPS.reviewers) {
      mocks.membershipFindUnique.mockResolvedValue(makeMembership(role));
      await expect(requireOrgMember("org-1", ...ROLE_GROUPS.reviewers)).resolves.toBeDefined();
    }
  });

  test("reviewers: rejects viewer", async () => {
    mocks.membershipFindUnique.mockResolvedValue(makeMembership("viewer"));
    await expect(requireOrgMember("org-1", ...ROLE_GROUPS.reviewers)).rejects.toMatchObject({
      code: "INSUFFICIENT_ROLE",
    });
  });

  // ROLE_GROUPS.anyMember — field_worker and supplier must NOT be present (security invariants)
  test("anyMember: field_worker is absent from the group (security invariant)", () => {
    expect(ROLE_GROUPS.anyMember).not.toContain("field_worker");
  });

  test("anyMember: supplier is absent from the group (security invariant)", () => {
    expect(ROLE_GROUPS.anyMember).not.toContain("supplier");
  });

  test("anyMember: rejects field_worker", async () => {
    mocks.membershipFindUnique.mockResolvedValue(makeMembership("field_worker"));
    await expect(requireOrgMember("org-1", ...ROLE_GROUPS.anyMember)).rejects.toMatchObject({
      code: "INSUFFICIENT_ROLE",
    });
  });

  test("anyMember: rejects supplier", async () => {
    mocks.membershipFindUnique.mockResolvedValue(makeMembership("supplier"));
    await expect(requireOrgMember("org-1", ...ROLE_GROUPS.anyMember)).rejects.toMatchObject({
      code: "INSUFFICIENT_ROLE",
    });
  });

  test("anyMember: accepts all listed roles", async () => {
    for (const role of ROLE_GROUPS.anyMember) {
      mocks.membershipFindUnique.mockResolvedValue(makeMembership(role));
      await expect(requireOrgMember("org-1", ...ROLE_GROUPS.anyMember)).resolves.toBeDefined();
    }
  });
});
