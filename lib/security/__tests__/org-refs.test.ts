// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const m = () => ({ findFirst: vi.fn() });
  return { organizationMembership: m(), project: m(), site: m(), facility: m(), environmentalPermit: m() };
});
vi.mock("@/lib/db", () => ({ prisma: db }));

import { orgRefsMessage } from "../org-refs";

beforeEach(() => vi.clearAllMocks());

describe("orgRefsMessage", () => {
  it("skips empty references", async () => {
    expect(await orgRefsMessage("org-a", { projectId: null, siteId: undefined, ownerUserId: "" })).toBeNull();
    expect(db.project.findFirst).not.toHaveBeenCalled();
  });

  it("looks every record up inside the organisation", async () => {
    db.project.findFirst.mockResolvedValue({ id: "p" });
    db.environmentalPermit.findFirst.mockResolvedValue(null);
    expect(await orgRefsMessage("org-a", { projectId: "p", permitId: "permit-b" })).toBe("Permit not found in this organisation.");
    expect(db.project.findFirst.mock.calls[0][0].where).toEqual({ id: "p", organizationId: "org-a" });
    expect(db.environmentalPermit.findFirst.mock.calls[0][0].where).toEqual({ id: "permit-b", organizationId: "org-a" });
  });

  it("treats any *UserId as a membership check", async () => {
    db.organizationMembership.findFirst.mockResolvedValue(null);
    expect(await orgRefsMessage("org-a", { signedOffByUserId: "user-b" })).toBe("That person is not a member of this organisation.");
    expect(db.organizationMembership.findFirst.mock.calls[0][0].where).toEqual({ userId: "user-b", organizationId: "org-a" });
  });
});
