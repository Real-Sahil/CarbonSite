// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({ user: { update: vi.fn() } }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn().mockResolvedValue({ user: { id: "user-a" } }),
}));

const req = (body: unknown) =>
  new NextRequest("http://localhost/api/me/theme", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

beforeEach(() => {
  vi.clearAllMocks();
  db.user.update.mockResolvedValue({});
});

describe("PATCH /api/me/theme", () => {
  it("saves the choice on the signed-in person's own user row", async () => {
    const { PATCH } = await import("../route");
    const res = await PATCH(req({ theme: "dark" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ theme: "dark" });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: "user-a" },
      data: { themePreference: "dark" },
    });
  });

  it.each([{ theme: "neon" }, {}, "dark", null])("refuses %j with 400 and writes nothing", async (body) => {
    const { PATCH } = await import("../route");
    const res = await PATCH(req(body));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_THEME");
    expect(db.user.update).not.toHaveBeenCalled();
  });
});
