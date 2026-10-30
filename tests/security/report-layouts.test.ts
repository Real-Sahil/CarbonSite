// @vitest-environment node
/**
 * Report layouts are per organisation: every read and write is scoped to the org in the URL, only
 * admins and editors may change one, an unknown report type is refused, and a bad body writes nothing.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  reportLayout: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
}));
const member = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  ROLE_GROUPS: { editor: ["admin", "editor"], dataReaders: ["admin", "editor", "viewer"] },
  requireOrgMember: member,
  AuthError: class AuthError extends Error {
    constructor(public readonly code: string, public readonly status: number) {
      super(code);
    }
  },
}));

import { AuthError } from "@/lib/auth/session";
import { DELETE, GET, PUT } from "@/app/api/orgs/[orgId]/report-layouts/[reportType]/route";

const ctx = (reportType = "ghg_protocol") => ({ params: Promise.resolve({ orgId: "org-b", reportType }) });
const put = (body: unknown) => new NextRequest("http://localhost/x", { method: "PUT", body: JSON.stringify(body) });
const plain = (method: string) => new NextRequest("http://localhost/x", { method });

beforeEach(() => {
  vi.clearAllMocks();
  member.mockResolvedValue({ session: { user: { id: "user-b" } } });
  db.reportLayout.findUnique.mockResolvedValue(null);
  db.reportLayout.upsert.mockResolvedValue({ version: 2 });
});

describe("report layout routes", () => {
  it("saves only inside the URL's organisation", async () => {
    const res = await PUT(put({ blocks: [{ id: "scope3" }, { id: "gas_breakdown", hidden: true }] }), ctx());
    expect(res.status).toBe(200);
    const arg = db.reportLayout.upsert.mock.calls[0][0];
    expect(arg.where.organizationId_reportType).toEqual({ organizationId: "org-b", reportType: "ghg_protocol" });
    expect(arg.create.organizationId).toBe("org-b");
  });

  it("asks for the editor group to save and reset, not viewers", async () => {
    await PUT(put({ blocks: [] }), ctx());
    await DELETE(plain("DELETE"), ctx());
    for (const call of member.mock.calls.slice(0, 2)) expect(call.slice(1)).toEqual(["admin", "editor"]);
  });

  it("refuses a caller who is not allowed and writes nothing", async () => {
    member.mockRejectedValueOnce(new AuthError("FORBIDDEN", 403));
    const res = await PUT(put({ blocks: [] }), ctx());
    expect(res.status).toBe(403);
    expect(db.reportLayout.upsert).not.toHaveBeenCalled();
  });

  it("answers 404 for a report type with no layout", async () => {
    expect((await PUT(put({ blocks: [] }), ctx("cdp"))).status).toBe(404);
    expect((await GET(plain("GET"), ctx("cdp"))).status).toBe(404);
    expect((await DELETE(plain("DELETE"), ctx("cdp"))).status).toBe(404);
    expect(db.reportLayout.upsert).not.toHaveBeenCalled();
    expect(db.reportLayout.deleteMany).not.toHaveBeenCalled();
  });

  it("rejects an oversized heading with 422 and writes nothing", async () => {
    const res = await PUT(put({ blocks: [{ id: "summary", title: "x".repeat(500) }] }), ctx());
    expect(res.status).toBe(422);
    expect(db.reportLayout.upsert).not.toHaveBeenCalled();
  });

  it("reads and resets scoped to the URL's organisation", async () => {
    await GET(plain("GET"), ctx());
    expect(db.reportLayout.findUnique.mock.calls[0][0].where.organizationId_reportType.organizationId).toBe("org-b");
    await DELETE(plain("DELETE"), ctx());
    expect(db.reportLayout.deleteMany).toHaveBeenCalledWith({ where: { organizationId: "org-b", reportType: "ghg_protocol" } });
  });
});
