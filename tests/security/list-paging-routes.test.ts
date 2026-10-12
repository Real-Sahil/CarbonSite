// @vitest-environment node
/**
 * Route-level checks for the three paged lists: the audit trail (offset), the audit log
 * (cursor) and snapshots (offset). A malformed or runaway limit/offset must never reach Prisma
 * as NaN or as an unbounded skip, and every query stays inside the organisation in the URL.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  prisma: {
    auditLog: { findMany: vi.fn(), count: vi.fn() },
    publishedSnapshot: { findMany: vi.fn(), count: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => db);
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/calculation/snapshot-slices", () => ({ copyLiveSlicesToSnapshot: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  requireOrgMember: vi.fn(async () => ({ session: { user: { id: "u1" } }, membership: { role: "admin" } })),
  ROLE_GROUPS: { sustainability: [], dataReaders: [], editor: [] },
  AuthError: class AuthError extends Error {},
}));

import { GET as getAuditTrail } from "@/app/api/orgs/[orgId]/audit-logs/route";
import { GET as getAuditLog } from "@/app/api/orgs/[orgId]/audit/logs/route";
import { GET as getSnapshots } from "@/app/api/orgs/[orgId]/snapshots/route";

const ctx = { params: Promise.resolve({ orgId: "org-a" }) };
const auditRow = (id: string) => ({
  id,
  createdAt: new Date("2026-10-01T00:00:00Z"),
  action: "x",
  resourceType: "y",
  resourceId: "z",
  actorUserId: null,
  actor: null,
  metadata: null,
  ipAddress: null,
  userAgent: null,
  auditContexts: [],
});
const rows = (n: number) => Array.from({ length: n }, (_, i) => auditRow(`r${i + 1}`));

beforeEach(() => {
  vi.clearAllMocks();
  db.prisma.auditLog.findMany.mockResolvedValue([]);
  db.prisma.auditLog.count.mockResolvedValue(0);
  db.prisma.publishedSnapshot.findMany.mockResolvedValue([]);
  db.prisma.publishedSnapshot.count.mockResolvedValue(0);
});

describe("GET /audit-logs (offset audit trail)", () => {
  const get = (qs: string) =>
    getAuditTrail(new NextRequest(`http://x/api/orgs/org-a/audit-logs${qs}`), ctx);

  it("defaults to 50 rows from the start and reports the page", async () => {
    db.prisma.auditLog.count.mockResolvedValue(120);
    const res = await get("");
    const args = db.prisma.auditLog.findMany.mock.calls[0][0];
    expect(args.take).toBe(50);
    expect(args.skip).toBe(0);
    const body = await res.json();
    expect(body.pagination).toEqual({ offset: 0, limit: 50, total: 120 });
  });

  it("clamps a runaway limit and offset instead of passing them through", async () => {
    await get("?limit=100000&offset=999999999");
    const args = db.prisma.auditLog.findMany.mock.calls[0][0];
    expect(args.take).toBe(100);
    expect(args.skip).toBe(100_000);
  });

  it("falls back to the defaults for a non-numeric limit or offset, never NaN", async () => {
    await get("?limit=abc&offset=-3");
    const args = db.prisma.auditLog.findMany.mock.calls[0][0];
    expect(args.take).toBe(50);
    expect(args.skip).toBe(0);
  });

  it("scopes the query and the count to the organisation in the URL", async () => {
    await get("?actorId=u9&organizationId=org-b");
    const where = db.prisma.auditLog.findMany.mock.calls[0][0].where;
    expect(where).toEqual({ organizationId: "org-a", actorUserId: "u9" });
    expect(db.prisma.auditLog.count.mock.calls[0][0].where).toEqual(where);
  });
});

describe("GET /audit/logs (cursor audit log)", () => {
  const get = (qs: string) =>
    getAuditLog(new NextRequest(`http://x/api/orgs/org-a/audit/logs${qs}`), ctx);

  it("returns a cursor when a further row exists, on the last row returned", async () => {
    // Default limit is 25, so the route fetches 26 rows to know whether more follow.
    db.prisma.auditLog.findMany.mockResolvedValue(rows(26));
    const res = await get("");
    expect(db.prisma.auditLog.findMany.mock.calls[0][0].take).toBe(26);
    const body = await res.json();
    expect(body.logs).toHaveLength(25);
    expect(body.pagination).toEqual({ nextCursor: "r25", hasMore: true });
  });

  it("returns no cursor on the last page", async () => {
    db.prisma.auditLog.findMany.mockResolvedValue(rows(3));
    const body = await (await get("?limit=5")).json();
    expect(body.logs).toHaveLength(3);
    expect(body.pagination).toEqual({ nextCursor: null, hasMore: false });
  });

  it("starts after the cursor row, skipping it", async () => {
    await get("?cursor=r25&limit=10");
    const args = db.prisma.auditLog.findMany.mock.calls[0][0];
    expect(args.cursor).toEqual({ id: "r25" });
    expect(args.skip).toBe(1);
    expect(args.take).toBe(11);
  });

  it("clamps an oversized limit to the maximum page", async () => {
    await get("?limit=5000");
    expect(db.prisma.auditLog.findMany.mock.calls[0][0].take).toBe(101);
  });
});

describe("GET /snapshots (offset list)", () => {
  const get = (qs: string) => getSnapshots(new NextRequest(`http://x/api/orgs/org-a/snapshots${qs}`), ctx);

  it("pages newest first inside the organisation and reports the total", async () => {
    db.prisma.publishedSnapshot.count.mockResolvedValue(7);
    db.prisma.publishedSnapshot.findMany.mockResolvedValue([{ id: "s1" }]);
    const res = await get("?offset=2&limit=1");
    const args = db.prisma.publishedSnapshot.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ organizationId: "org-a" });
    expect(args.orderBy).toEqual({ publishedAt: "desc" });
    expect(args.skip).toBe(2);
    expect(args.take).toBe(1);
    const body = await res.json();
    expect(body.data).toEqual([{ id: "s1" }]);
    expect(body.pagination).toEqual({ offset: 2, limit: 1, total: 7 });
  });

  it("clamps a runaway offset and limit", async () => {
    await get("?offset=999999999&limit=100000");
    const args = db.prisma.publishedSnapshot.findMany.mock.calls[0][0];
    expect(args.skip).toBe(100_000);
    expect(args.take).toBe(100);
  });
});
