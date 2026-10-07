// @vitest-environment node
/** The sidebar's project choice: only the organisation's own projects can be selected. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({ prisma: {} }));
const session = vi.hoisted(() => ({ requireOrgMember: vi.fn(), AuthError: class AuthError extends Error {} }));
vi.mock("@/lib/auth/session", () => session);
vi.mock("@/lib/security/org-refs", () => ({
  orgRefsError: vi.fn(async (_o: string, r: { projectId?: string | null }) =>
    r.projectId === "proj-of-org-b" ? new Response(JSON.stringify({ code: "NOT_FOUND" }), { status: 404 }) : null),
}));

import { PUT } from "@/app/api/orgs/[orgId]/selected-project/route";

const ctx = { params: Promise.resolve({ orgId: "org-a" }) };
const put = (body: unknown) => new NextRequest("http://x/api", { method: "PUT", body: JSON.stringify(body) });

beforeEach(() => session.requireOrgMember.mockResolvedValue({ session: { user: { id: "u1" } }, membership: { role: "viewer" } }));

describe("selected project", () => {
  it("refuses another organisation's project and sets no cookie", async () => {
    const res = await PUT(put({ projectId: "proj-of-org-b" }), ctx);
    expect(res.status).toBe(404);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("sets an org-named cookie for an own project and clears it for null", async () => {
    const set = await PUT(put({ projectId: "p1" }), ctx);
    expect(set.headers.get("set-cookie")).toContain("mo_project_org-a=p1");
    const clear = await PUT(put({ projectId: null }), ctx);
    expect(clear.headers.get("set-cookie")).toMatch(/mo_project_org-a=;.*Max-Age=0/i);
  });
});
