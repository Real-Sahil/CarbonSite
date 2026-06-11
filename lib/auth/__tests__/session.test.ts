import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authGetSession: vi.fn(),
  membershipFindUnique: vi.fn(),
  sessionFindUnique: vi.fn(),
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
  },
}));

import { AuthError, requireOrgMember } from "../session";

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
    mocks.authGetSession.mockResolvedValue(session);
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
});
