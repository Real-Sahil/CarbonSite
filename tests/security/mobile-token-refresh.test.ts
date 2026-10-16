// @vitest-environment node
/**
 * Mobile token refresh. A session slides forward on each refresh but never past
 * 90 days from sign-in, and a token rotates at most once: two refreshes racing on
 * the same token cannot both succeed.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  session: { findUnique: vi.fn(), updateMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/security/rate-limit-async", () => ({ rateLimitRequest: vi.fn(async () => null) }));

import { POST } from "@/app/api/auth/token/route";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-16T12:00:00Z");

type SessionRow = {
  id: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
};

function sessionRow(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: "s1",
    userId: "u1",
    createdAt: new Date(NOW.getTime() - 1 * DAY),
    expiresAt: new Date(NOW.getTime() + 10 * DAY),
    revokedAt: null,
    ...overrides,
  };
}

function refresh(token = "old-token") {
  return POST(
    new NextRequest("http://localhost/api/auth/token", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    }),
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  db.session.findUnique.mockReset();
  db.session.updateMany.mockReset();
});

describe("POST /api/auth/token", () => {
  it("rotates the token and slides expiry 30 days ahead inside the lifetime", async () => {
    db.session.findUnique.mockResolvedValue(sessionRow());
    db.session.updateMany.mockResolvedValue({ count: 1 });

    const res = await refresh();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(db.session.updateMany).toHaveBeenCalledWith({
      where: { id: "s1", token: "old-token", revokedAt: null },
      data: { token: expect.any(String), expiresAt: new Date(NOW.getTime() + 30 * DAY) },
    });
    expect(body.token).not.toBe("old-token");
    expect(body.expiresAt).toBe(new Date(NOW.getTime() + 30 * DAY).toISOString());
  });

  it("caps the new expiry at 90 days from sign-in", async () => {
    db.session.findUnique.mockResolvedValue(sessionRow({ createdAt: new Date(NOW.getTime() - 89 * DAY) }));
    db.session.updateMany.mockResolvedValue({ count: 1 });

    const res = await refresh();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.expiresAt).toBe(new Date(NOW.getTime() + 1 * DAY).toISOString());
  });

  it("refuses a session older than 90 days even though its sliding expiry is still ahead", async () => {
    db.session.findUnique.mockResolvedValue(sessionRow({ createdAt: new Date(NOW.getTime() - 91 * DAY) }));

    const res = await refresh();

    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("SESSION_EXPIRED");
    expect(db.session.updateMany).not.toHaveBeenCalled();
  });

  it("refuses a revoked session without rotating it", async () => {
    db.session.findUnique.mockResolvedValue(sessionRow({ revokedAt: new Date(NOW.getTime() - 1000) }));

    const res = await refresh();

    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("SESSION_EXPIRED");
    expect(db.session.updateMany).not.toHaveBeenCalled();
  });

  it("lets only one of two refreshes racing on the same token succeed", async () => {
    db.session.findUnique.mockResolvedValue(sessionRow());
    db.session.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    const [first, second] = await Promise.all([refresh(), refresh()]);

    expect([first.status, second.status].sort()).toEqual([200, 401]);
    const loser = first.status === 401 ? first : second;
    expect((await loser.json()).code).toBe("UNAUTHENTICATED");
  });
});
