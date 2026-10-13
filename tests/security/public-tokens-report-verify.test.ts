// @vitest-environment node
/**
 * GET /api/public/reports/verify/[token] is public and unauthenticated. Its audit trail names an actor only
 * as "Organisation member" or "System", never by user id, and an expired link is refused.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  reportVerificationToken: { findUnique: vi.fn(), update: vi.fn() },
  auditLog: { findMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/storage", () => ({
  presignDownload: vi.fn(async (key: string) => `https://signed.example/${key}`),
}));

import { GET } from "@/app/api/public/reports/verify/[token]/route";

const DAY = 86_400_000;
const report = {
  id: "report-1",
  organizationId: "org-a",
  type: "ghg_protocol",
  status: "ready",
  version: 1,
  createdAt: new Date("2026-01-10T10:00:00Z"),
  pdfChecksum: "abc123",
  pdfStorageKey: "org/org-a/reports/report-1/report.pdf",
  csvStorageKey: null,
  snapshotId: "snap-1",
  organization: { name: "Org A Ltd" },
  snapshot: {
    version: 2,
    publishedAt: new Date("2026-01-09T10:00:00Z"),
    reportingPeriod: {
      label: "FY2025",
      startDate: new Date("2025-01-01T00:00:00Z"),
      endDate: new Date("2025-12-31T00:00:00Z"),
    },
  },
};

const link = (over: Record<string, unknown> = {}) => ({
  id: "vt-1",
  token: "tok-1",
  expiresAt: new Date(Date.now() + 90 * DAY),
  report,
  ...over,
});

const verify = (token = "tok-1") =>
  GET(
    new NextRequest(`http://localhost/api/public/reports/verify/${token}`, {
      headers: { accept: "application/json" },
    }),
    { params: Promise.resolve({ token }) },
  );

beforeEach(() => {
  vi.clearAllMocks();
  db.reportVerificationToken.update.mockResolvedValue({});
  db.auditLog.findMany.mockResolvedValue([]);
});

describe("public report verification", () => {
  it("names audit actors only as 'Organisation member' or 'System', never by user id", async () => {
    db.reportVerificationToken.findUnique.mockResolvedValue(link());
    db.auditLog.findMany.mockResolvedValue([
      { createdAt: new Date("2026-01-09T10:00:00Z"), actorUserId: "user-7f3a", action: "report.published" },
      { createdAt: new Date("2026-01-08T10:00:00Z"), actorUserId: null, action: "snapshot.calculated" },
    ]);
    const res = await verify();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.auditTrail).toEqual([
      { timestamp: "2026-01-09T10:00:00.000Z", actor: "Organisation member", action: "report.published" },
      { timestamp: "2026-01-08T10:00:00.000Z", actor: "System", action: "snapshot.calculated" },
    ]);
    expect(JSON.stringify(body)).not.toContain("user-7f3a");
  });

  it("an expired link is refused and records no access", async () => {
    db.reportVerificationToken.findUnique.mockResolvedValue(link({ expiresAt: new Date(Date.now() - 1_000) }));
    const res = await verify();
    expect(res.status).toBe(410);
    expect(db.auditLog.findMany).not.toHaveBeenCalled();
    expect(db.reportVerificationToken.update).not.toHaveBeenCalled();
  });

  it("an unknown token answers 404", async () => {
    db.reportVerificationToken.findUnique.mockResolvedValue(null);
    expect((await verify("no-such-token")).status).toBe(404);
  });
});
