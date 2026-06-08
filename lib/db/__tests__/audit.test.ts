import { describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auditLogCreate: vi.fn(),
}));

vi.mock("../index", () => ({
  prisma: {
    auditLog: {
      create: mocks.auditLogCreate,
    },
  },
}));

import { writeAuditLog } from "../audit";

describe("writeAuditLog", () => {
  test("accepts precise invite acceptance audit actions", async () => {
    await writeAuditLog({
      organizationId: "org-1",
      actorUserId: "user-1",
      action: "org.member.invite_accepted",
      resourceType: "invite_link",
      resourceId: "invite-1",
      metadata: {
        membershipId: "membership-1",
      },
    });

    expect(mocks.auditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "org.member.invite_accepted",
        organizationId: "org-1",
        resourceId: "invite-1",
        resourceType: "invite_link",
      }),
    });
  });
});
