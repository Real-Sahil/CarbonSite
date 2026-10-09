// @vitest-environment node
/** Company lookup: members with supplier-edit roles only, validated input, no key means a clear 503. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const session = vi.hoisted(() => ({ requireOrgMember: vi.fn(), AuthError: class AuthError extends Error {}, ROLE_GROUPS: { editor: ["admin", "editor"], projectManagers: ["admin", "project_manager"] } }));
vi.mock("@/lib/auth/session", () => session);
vi.mock("@/lib/security/rate-limit-async", () => ({ rateLimitRequest: vi.fn().mockResolvedValue(null) }));

import { GET } from "@/app/api/orgs/[orgId]/companies/route";
const call = (qs: string) => GET(new NextRequest(`http://x/api?${qs}`), { params: Promise.resolve({ orgId: "org-a" }) });

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.COMPANIES_HOUSE_API_KEY;
  session.requireOrgMember.mockResolvedValue({ session: { user: { id: "u1" } }, membership: { role: "admin" } });
});

describe("GET companies", () => {
  it("checks the role list and the organisation", async () => {
    await call("q=tarmac");
    expect(session.requireOrgMember.mock.calls[0][0]).toBe("org-a");
    expect(session.requireOrgMember.mock.calls[0]).toContain("admin");
    expect(session.requireOrgMember.mock.calls[0]).not.toContain("viewer");
  });
  it("rejects a short name and a malformed number", async () => {
    expect((await call("q=ab")).status).toBe(422);
    expect((await call("number=12")).status).toBe(422);
    expect((await call("")).status).toBe(422);
  });
  it("answers 503 with a reason when no key is set", async () => {
    const res = await call("q=tarmac");
    expect(res.status).toBe(503);
    expect((await res.json()).details?.reason).toBe("no_key");
  });
});
