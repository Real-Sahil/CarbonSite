import { describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auditLogCreate: vi.fn(),
  auditLogFindFirst: vi.fn().mockResolvedValue(null),
  auditLogFindMany: vi.fn(),
  executeRaw: vi.fn(),
}));

vi.mock("../index", () => ({
  prisma: {
    auditLog: {
      create: mocks.auditLogCreate,
      findFirst: mocks.auditLogFindFirst,
      findMany: mocks.auditLogFindMany,
    },
    // writeAuditLog() serializes hash-chain writes per-org inside a
    // transaction; the test double just runs the callback against the same
    // mocked client rather than a real Prisma transaction.
    $transaction: (fn: (tx: unknown) => unknown) =>
      fn({
        auditLog: { create: mocks.auditLogCreate, findFirst: mocks.auditLogFindFirst },
        $executeRaw: mocks.executeRaw,
      }),
  },
}));

import { writeAuditLog, verifyAuditChain } from "../audit";

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

  test("accepts direct member add audit actions", async () => {
    await writeAuditLog({
      organizationId: "org-1",
      actorUserId: "admin-1",
      action: "org.member.added",
      resourceType: "membership",
      resourceId: "membership-1",
      metadata: {
        targetUserId: "user-1",
        role: "reviewer",
      },
    });

    expect(mocks.auditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "org.member.added",
        organizationId: "org-1",
        resourceId: "membership-1",
        resourceType: "membership",
      }),
    });
  });

  test("accepts import error export download audit actions", async () => {
    await writeAuditLog({
      organizationId: "org-1",
      actorUserId: "reviewer-1",
      action: "import.error_export_downloaded",
      resourceType: "import_batch",
      resourceId: "import-1",
      metadata: {
        errorCount: 3,
      },
    });

    expect(mocks.auditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "import.error_export_downloaded",
        organizationId: "org-1",
        resourceId: "import-1",
        resourceType: "import_batch",
      }),
    });
  });

  test("chains hash to the previous row and persists explicit ip/user-agent", async () => {
    mocks.auditLogFindFirst.mockResolvedValueOnce({ hash: "prior-hash-abc" });

    await writeAuditLog({
      organizationId: "org-1",
      actorUserId: "user-1",
      action: "record.created",
      resourceType: "activity_record",
      resourceId: "record-1",
      ipAddress: "203.0.113.7",
      userAgent: "test-agent/1.0",
    });

    const call = mocks.auditLogCreate.mock.calls.at(-1)![0];
    expect(call.data.previousHash).toBe("prior-hash-abc");
    expect(call.data.hash).toEqual(expect.any(String));
    expect(call.data.hash).not.toBe("prior-hash-abc");
    expect(call.data.ipAddress).toBe("203.0.113.7");
    expect(call.data.userAgent).toBe("test-agent/1.0");
  });

  test("first row in a chain has a null previousHash", async () => {
    mocks.auditLogFindFirst.mockResolvedValueOnce(null);

    await writeAuditLog({
      organizationId: "org-2",
      action: "org.created",
      resourceType: "organization",
      resourceId: "org-2",
    });

    const call = mocks.auditLogCreate.mock.calls.at(-1)![0];
    expect(call.data.previousHash).toBeNull();
    expect(call.data.hash).toEqual(expect.any(String));
  });
});

describe("verifyAuditChain", () => {
  test("returns null for an intact chain", async () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const base = {
      actorUserId: "user-1",
      action: "record.created",
      resourceType: "activity_record",
      resourceId: "record-1",
      metadata: {},
      createdAt,
    };
    const { createHash } = await import("crypto");
    const hash1 = createHash("sha256")
      .update(["", "org-1", "user-1", "record.created", "activity_record", "record-1", "{}", createdAt.toISOString()].join("|"))
      .digest("hex");
    const hash2 = createHash("sha256")
      .update([hash1, "org-1", "user-1", "record.created", "activity_record", "record-1", "{}", createdAt.toISOString()].join("|"))
      .digest("hex");

    mocks.auditLogFindMany.mockResolvedValueOnce([
      { ...base, previousHash: null, hash: hash1 },
      { ...base, previousHash: hash1, hash: hash2 },
    ]);

    await expect(verifyAuditChain("org-1")).resolves.toBeNull();
  });

  test("detects a tampered row", async () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    mocks.auditLogFindMany.mockResolvedValueOnce([
      {
        actorUserId: "user-1",
        action: "record.created",
        resourceType: "activity_record",
        resourceId: "record-1",
        metadata: {},
        createdAt,
        previousHash: null,
        hash: "this-does-not-match-the-recomputed-hash",
      },
    ]);

    await expect(verifyAuditChain("org-1")).resolves.toBe(0);
  });

  test("skips pre-chain rows with no hash", async () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    mocks.auditLogFindMany.mockResolvedValueOnce([
      {
        actorUserId: "user-1",
        action: "record.created",
        resourceType: "activity_record",
        resourceId: "record-1",
        metadata: {},
        createdAt,
        previousHash: null,
        hash: null,
      },
    ]);

    await expect(verifyAuditChain("org-1")).resolves.toBeNull();
  });
});
