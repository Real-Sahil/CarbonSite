// @vitest-environment node
/**
 * A revoked session ends at once. Better Auth's own lookup ignores revokedAt, so
 * getSession() checks the row by id, and revoking deletes the row outright.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { POST as revoke } from "@/app/api/auth/revoke/route";

const mocks = vi.hoisted(() => ({
  prisma: {
    session: { findUnique: vi.fn(), deleteMany: vi.fn() },
  },
  betterAuth: { api: { getSession: vi.fn() } },
}));

vi.mock("@/lib/db", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth/index", () => ({ auth: mocks.betterAuth }));
vi.mock("@/lib/auth/session-cookie", () => ({ verifiedSessionToken: vi.fn(() => null) }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

const DAY = 86_400_000;

function signedIn(sessionId: string) {
  return {
    session: {
      id: sessionId,
      token: "session-token",
      userId: "u-1",
      expiresAt: new Date(Date.now() + DAY),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    user: {
      id: "u-1",
      email: "a@org-a.test",
      emailVerified: true,
      name: "Admin A",
      createdAt: new Date(),
      updatedAt: new Date(),
      themePreference: null,
    },
  };
}

function post(body?: unknown) {
  return new NextRequest("http://localhost/api/auth/revoke", {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  mocks.betterAuth.api.getSession.mockResolvedValue(signedIn("s-1"));
  mocks.prisma.session.findUnique.mockResolvedValue({ revokedAt: null });
});

describe("getSession with a revoked row", () => {
  it("refuses a session that Better Auth still resolves when its row is revoked", async () => {
    mocks.prisma.session.findUnique.mockResolvedValue({ revokedAt: new Date() });

    expect(await getSession()).toBeNull();
    expect(mocks.prisma.session.findUnique).toHaveBeenCalledWith({
      where: { id: "s-1" },
      select: { revokedAt: true },
    });
  });

  it("returns the session when its row is live", async () => {
    const result = signedIn("s-1");
    mocks.betterAuth.api.getSession.mockResolvedValue(result);

    expect(await getSession()).toBe(result);
  });

  it("refuses the session when the revocation check fails", async () => {
    mocks.prisma.session.findUnique.mockRejectedValue(new Error("connection lost"));

    expect(await getSession()).toBeNull();
  });

  it("refuses the session when its row has been deleted", async () => {
    mocks.prisma.session.findUnique.mockResolvedValue(null);

    expect(await getSession()).toBeNull();
  });
});

describe("POST /api/auth/revoke", () => {
  it("deletes the named session, scoped to the caller", async () => {
    mocks.prisma.session.deleteMany.mockResolvedValue({ count: 1 });

    const res = await revoke(post({ sessionId: "s-2" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ revoked: 1 });
    expect(mocks.prisma.session.deleteMany).toHaveBeenCalledWith({
      where: { id: "s-2", userId: "u-1" },
    });
  });

  it("revokes the calling session when the body is empty", async () => {
    mocks.prisma.session.deleteMany.mockResolvedValue({ count: 1 });

    await revoke(post());

    expect(mocks.prisma.session.deleteMany).toHaveBeenCalledWith({
      where: { id: "s-1", userId: "u-1" },
    });
  });

  it("answers 404 for a session that is not the caller's", async () => {
    mocks.prisma.session.deleteMany.mockResolvedValue({ count: 0 });

    const res = await revoke(post({ sessionId: "s-of-someone-else" }));

    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("NOT_FOUND");
  });

  it("all deletes every session of the caller", async () => {
    mocks.prisma.session.deleteMany.mockResolvedValue({ count: 3 });

    const res = await revoke(post({ all: true }));

    expect(await res.json()).toEqual({ revoked: 3 });
    expect(mocks.prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "u-1" } });
  });
});
