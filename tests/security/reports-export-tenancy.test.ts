// @vitest-environment node
/**
 * Export routes authenticate with an API key. A key for org B must not read org A's snapshot,
 * whether it names org A in the URL (403) or org B with org A's snapshot id (404).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  publishedSnapshot: { findUnique: vi.fn(), findFirst: vi.fn() },
  calculationRun: { findUnique: vi.fn() },
  dashboardAggregate: { findMany: vi.fn() },
  emissionCalculation: { findMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/auth/api-key", () => ({ validateApiKey: vi.fn(async () => "org-b") }));

import { GET as exportReport } from "@/app/api/orgs/[orgId]/reports/export/route";
import { GET as exportXbrl } from "@/app/api/orgs/[orgId]/reports/xbrl-export/route";

const get = (orgId: string) =>
  [
    new NextRequest(`http://localhost/x?snapshotId=snap-a`, { headers: { authorization: "Bearer k" } }),
    { params: Promise.resolve({ orgId }) },
  ] as const;

beforeEach(() => {
  vi.clearAllMocks();
  db.publishedSnapshot.findUnique.mockResolvedValue({ id: "snap-a", organizationId: "org-a" });
  db.publishedSnapshot.findFirst.mockResolvedValue(null);
});

describe.each([
  ["export", exportReport],
  ["xbrl-export", exportXbrl],
])("%s", (_name, handler) => {
  it("403 when the key's org differs from the URL org", async () => {
    expect((await handler(...get("org-a"))).status).toBe(403);
    expect(db.publishedSnapshot.findUnique).not.toHaveBeenCalled();
  });

  it("404 when org B's key names org A's snapshot in an org B URL, and reads no aggregates", async () => {
    expect((await handler(...get("org-b"))).status).toBe(404);
    expect(db.dashboardAggregate.findMany).not.toHaveBeenCalled();
    expect(db.emissionCalculation.findMany).not.toHaveBeenCalled();
  });
});
