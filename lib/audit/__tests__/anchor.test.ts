import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  auditLog: { findFirst: vi.fn(), findMany: vi.fn() },
  organization: { findMany: vi.fn() },
}));
const storage = vi.hoisted(() => ({
  external: true,
  files: new Map<string, Buffer>(),
  getObject: vi.fn(),
  putObject: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/storage", () => ({
  isExternalStorageDriver: () => storage.external,
  getObject: (key: string) => storage.getObject(key),
  putObject: (key: string, body: Buffer, type: string) => storage.putObject(key, body, type),
  keys: {
    auditAnchor: (orgId: string, seq: string) => `org/${orgId}/audit-anchors/${seq}.json`,
    auditAnchorLatest: (orgId: string) => `org/${orgId}/audit-anchors/latest.json`,
  },
}));

const { writeAuditAnchor, checkAuditAnchor, anchorAllAuditChains } = await import("@/lib/audit/anchor");

const ORG = "org_1";
const LATEST = `org/${ORG}/audit-anchors/latest.json`;

function anchorBody(overrides: Record<string, unknown> = {}) {
  return Buffer.from(JSON.stringify({
    organizationId: ORG,
    headSeq: "42",
    headHash: "abc",
    chainVersion: 2,
    anchoredAt: "2026-10-10T04:23:00.000Z",
    ...overrides,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  storage.external = true;
  storage.files.clear();
  storage.putObject.mockImplementation(async (key: string, body: Buffer) => {
    storage.files.set(key, body);
  });
  storage.getObject.mockImplementation(async (key: string) => {
    const body = storage.files.get(key);
    if (!body) throw new Error(`not found: ${key}`);
    return body;
  });
});

describe("writeAuditAnchor", () => {
  it("writes nothing for an empty chain", async () => {
    db.auditLog.findFirst.mockResolvedValue(null);
    expect(await writeAuditAnchor(ORG)).toBeNull();
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it("writes nothing when the head is a legacy row with no hash", async () => {
    db.auditLog.findFirst.mockResolvedValue({ chainSeq: BigInt(7), hash: null });
    expect(await writeAuditAnchor(ORG)).toBeNull();
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it("writes the head to a per-sequence file and to latest.json", async () => {
    db.auditLog.findFirst.mockResolvedValue({ chainSeq: BigInt(42), hash: "abc" });
    const anchor = await writeAuditAnchor(ORG, new Date("2026-10-10T04:23:00Z"));

    expect(anchor).toMatchObject({ organizationId: ORG, headSeq: "42", headHash: "abc", chainVersion: 2 });
    const keysWritten = storage.putObject.mock.calls.map((c) => c[0]);
    expect(keysWritten).toEqual([`org/${ORG}/audit-anchors/42.json`, LATEST]);
    expect(JSON.parse(storage.files.get(LATEST)!.toString("utf8")).headHash).toBe("abc");
  });
});

describe("checkAuditAnchor", () => {
  it("reports none when no anchor has been written", async () => {
    const result = await checkAuditAnchor(ORG);
    expect(result.status).toBe("none");
    expect(result.external).toBe(true);
  });

  it("reports none for a file this code did not write", async () => {
    storage.files.set(LATEST, Buffer.from("{\"headSeq\":\"x\"}"));
    expect((await checkAuditAnchor(ORG)).status).toBe("none");
  });

  it("refuses an anchor that names another organisation", async () => {
    storage.files.set(LATEST, anchorBody({ organizationId: "org_other" }));
    expect((await checkAuditAnchor(ORG)).status).toBe("none");
  });

  it("matches while the anchored row keeps its hash", async () => {
    storage.files.set(LATEST, anchorBody());
    db.auditLog.findFirst.mockResolvedValue({ hash: "abc" });
    const result = await checkAuditAnchor(ORG);
    expect(result.status).toBe("matches");
    expect(db.auditLog.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: ORG, chainSeq: BigInt(42) },
    }));
  });

  it("reports truncated when the anchored row has been removed", async () => {
    storage.files.set(LATEST, anchorBody());
    db.auditLog.findFirst.mockResolvedValue(null);
    expect((await checkAuditAnchor(ORG)).status).toBe("truncated");
  });

  it("reports rewritten when the anchored row carries another hash", async () => {
    storage.files.set(LATEST, anchorBody());
    db.auditLog.findFirst.mockResolvedValue({ hash: "def" });
    expect((await checkAuditAnchor(ORG)).status).toBe("rewritten");
  });
});

describe("anchorAllAuditChains", () => {
  it("skips on the db and local drivers, where the anchor would sit beside the rows", async () => {
    storage.external = false;
    const result = await anchorAllAuditChains();
    expect(result.anchored).toBe(0);
    expect(result.skipped).toMatch(/not external/);
    expect(db.organization.findMany).not.toHaveBeenCalled();
  });

  it("anchors each organisation and counts failures without stopping", async () => {
    db.organization.findMany.mockResolvedValueOnce([{ id: "org_a" }, { id: "org_b" }]);
    db.auditLog.findFirst
      .mockResolvedValueOnce({ chainSeq: BigInt(1), hash: "h1" })
      .mockRejectedValueOnce(new Error("boom"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await anchorAllAuditChains();

    expect(result).toEqual({ anchored: 1, failed: 1 });
    expect(storage.putObject).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });
});
