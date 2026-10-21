// @vitest-environment node
/** Creating a report with another organisation's snapshot id must 404 and create nothing. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const db = vi.hoisted(() => ({
  publishedSnapshot: { findUnique: vi.fn() },
  report: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/jobs/dispatch", () => ({ dispatchReport: vi.fn() }));
vi.mock("@/lib/billing/limits", () => ({
  requireFeature: vi.fn(),
  requireReportType: vi.fn(),
  requireActiveBilling: vi.fn(),
  requireWithinUsageLimit: vi.fn(),
}));
vi.mock("@/lib/billing/usage", () => ({ recordUsage: vi.fn() }));
vi.mock("@/lib/api/versioned-handler", () => ({
  withApiVersion: vi.fn(async () => ({
    version: "1",
    json: (body: unknown, init?: ResponseInit) => NextResponse.json(body, init),
  })),
  checkDeprecationWarning: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  AuthError: class extends Error {},
  ROLE_GROUPS: { editor: ["admin", "editor"], dataReaders: ["admin", "editor", "viewer"] },
  requireOrgMember: vi.fn(async () => ({ session: { user: { id: "user-b" } } })),
}));

import { POST } from "@/app/api/orgs/[orgId]/reports/route";

const post = (orgId: string) =>
  POST(
    new NextRequest("http://localhost/x", {
      method: "POST",
      body: JSON.stringify({ snapshotId: "snap-a", type: "inventory" }),
    }),
    { params: Promise.resolve({ orgId }) },
  );

beforeEach(() => {
  vi.clearAllMocks();
  db.publishedSnapshot.findUnique.mockResolvedValue({
    organizationId: "org-a",
    reportingPeriodId: "period-a",
  });
  db.report.findFirst.mockResolvedValue(null);
  db.report.create.mockResolvedValue({ id: "rep-1" });
});

describe("reports POST snapshot tenancy", () => {
  it("404 when org B names org A's snapshot, and creates no report", async () => {
    const res = await post("org-b");
    expect(res.status).toBe(404);
    expect(db.report.create).not.toHaveBeenCalled();
  });

  it("passes the snapshot check for the owning org", async () => {
    const res = await post("org-a");
    expect(res.status).not.toBe(404);
  });
});
