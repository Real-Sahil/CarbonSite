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
import { CHAIN_VERSION, rowHash } from "@/lib/audit/chain";

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

describe("writeAuditLog chain", () => {
  test("stores the exact values it hashed, so the stored row recomputes to its own hash", async () => {
    mocks.auditLogCreate.mockClear();
    mocks.auditLogFindFirst.mockResolvedValueOnce({ hash: "prev-hash" });
    await writeAuditLog({ organizationId: "org-1", actorUserId: "u1", action: "record.created", resourceType: "activity_record", resourceId: "r1", metadata: { z: 1, a: { y: 2, b: 3 } } });
    const { data } = mocks.auditLogCreate.mock.calls.at(-1)![0];
    expect(data.previousHash).toBe("prev-hash");
    expect(data.hashVersion).toBe(CHAIN_VERSION);
    expect(data.createdAt).toBeInstanceOf(Date);
    // what comes back from the database: same values, metadata keys in a different order
    const stored = { ...data, metadata: { a: { b: 3, y: 2 }, z: 1 } };
    expect(rowHash(stored)).toBe(data.hash);
    // the previous row is the latest by chainSeq, under a per-organisation lock
    expect(mocks.auditLogFindFirst.mock.calls.at(-1)![0].orderBy).toEqual({ chainSeq: "desc" });
    expect(mocks.executeRaw).toHaveBeenCalled();
  });
});

describe("verifyAuditChain", () => {
  const mk = (n: number) => {
    const rows: Array<Record<string, unknown>> = [];
    let prev: string | null = null;
    for (let i = 0; i < n; i++) {
      const f = { actorUserId: "u1", action: "record.created", resourceType: "activity_record", resourceId: `r${i}`, metadata: { i }, createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)) };
      const hash = rowHash({ ...f, previousHash: prev, organizationId: "org-1" });
      rows.push({ chainSeq: BigInt(i + 1), ...f, previousHash: prev, hash, hashVersion: CHAIN_VERSION });
      prev = hash;
    }
    return rows;
  };

  test("reports an intact chain, reading it page by page", async () => {
    mocks.auditLogFindMany.mockReset();
    mocks.auditLogFindMany.mockResolvedValueOnce(mk(3)).mockResolvedValueOnce([]);
    await expect(verifyAuditChain("org-1")).resolves.toMatchObject({ status: "intact", rows: 3, verified: 3, headSeq: "3" });
    expect(mocks.auditLogFindMany.mock.calls[0][0].orderBy).toEqual({ chainSeq: "asc" });
    expect(mocks.auditLogFindMany.mock.calls[1][0].where.chainSeq).toEqual({ gt: BigInt(3) });
  });

  test("reports an empty chain as empty", async () => {
    mocks.auditLogFindMany.mockReset();
    mocks.auditLogFindMany.mockResolvedValueOnce([]);
    await expect(verifyAuditChain("org-1")).resolves.toMatchObject({ status: "empty", rows: 0 });
  });

  test("finds a tampered row and says where", async () => {
    mocks.auditLogFindMany.mockReset();
    const rows = mk(4);
    rows[2] = { ...rows[2], action: "record.deleted" };
    mocks.auditLogFindMany.mockResolvedValueOnce(rows);
    await expect(verifyAuditChain("org-1")).resolves.toMatchObject({ status: "broken", firstBreak: { chainSeq: "3", reason: "content" } });
  });

  test("does not call rows from before the recomputable hash verified", async () => {
    mocks.auditLogFindMany.mockReset();
    mocks.auditLogFindMany.mockResolvedValueOnce([{ chainSeq: BigInt(1), createdAt: new Date(), actorUserId: null, action: "x", resourceType: "t", resourceId: "x", metadata: {}, previousHash: null, hash: "old", hashVersion: null }]).mockResolvedValueOnce([]);
    await expect(verifyAuditChain("org-1")).resolves.toMatchObject({ status: "intact", verified: 0, legacy: 1 });
  });
});
