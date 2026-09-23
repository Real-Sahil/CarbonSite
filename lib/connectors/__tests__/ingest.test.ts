// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  reportingPeriod: { findFirst: vi.fn() },
  importBatch: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/jobs/dispatch", () => ({ dispatchImport: vi.fn().mockResolvedValue("processed") }));
vi.mock("@/lib/storage", () => ({ keys: { importSource: (o: string, b: string) => `org/${o}/imports/${b}/source.csv` }, putObject: vi.fn() }));
vi.mock("@/lib/security/rate-limit-async", () => ({ rateLimitRequest: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/auth/api-key", () => ({
  validateApiKey: vi.fn(async (h: string | null) => {
    if (h === "Bearer csk_orgA") return "org-a";
    throw new Error("bad key");
  }),
}));

import { recordsToCsv } from "../ingest";
import { CANONICAL_FIELDS } from "@/lib/imports/column-mapper";
import { putObject } from "@/lib/storage";
import { dispatchImport } from "@/lib/jobs/dispatch";

const params = (orgId = "org-a") => Promise.resolve({ orgId });
const body = {
  reportingPeriodId: "p1",
  records: [{ emissionCategoryCode: "s2-electricity-lb", amount: 1200, unit: "kWh", activityDate: "2026-03-01", facilityName: "Depot, North" }],
};
const post = (b: unknown, key = "csk_orgA") =>
  new NextRequest("http://localhost/x", { method: "POST", body: JSON.stringify(b), headers: { authorization: `Bearer ${key}` } });

beforeEach(() => {
  vi.clearAllMocks();
  db.reportingPeriod.findFirst.mockResolvedValue({ status: "open" });
  db.importBatch.findFirst.mockResolvedValue(null);
  db.importBatch.create.mockResolvedValue({ id: "b1" });
  db.importBatch.findUnique.mockResolvedValue({ id: "b1", state: "ready_to_commit", errorCount: 0, warningCount: 0 });
});

describe("connector ingest", () => {
  it("stages a batch through the normal import pipeline, not straight into records", async () => {
    const { POST } = await import("@/app/api/orgs/[orgId]/integrations/webhooks/ingest/route");
    const res = await POST(post(body), { params: params() });
    expect(res.status).toBe(202);
    expect(db.importBatch.create.mock.calls[0][0].data).toMatchObject({ organizationId: "org-a", templateKey: "connector:webhook", createdByUserId: null });
    expect(dispatchImport).toHaveBeenCalledWith({ importBatchId: "b1", orgId: "org-a" });
    const csv = vi.mocked(putObject).mock.calls[0][1].toString();
    expect(csv).toContain('s2-electricity-lb,1200,kWh,2026-03-01,,,,"Depot, North"');
  });

  it("rejects a key for another organisation", async () => {
    const { POST } = await import("@/app/api/orgs/[orgId]/integrations/webhooks/ingest/route");
    const res = await POST(post(body), { params: params("org-b") });
    expect(res.status).toBe(403);
    expect(db.importBatch.create).not.toHaveBeenCalled();
  });

  it("rejects a missing or unknown key", async () => {
    const { POST } = await import("@/app/api/orgs/[orgId]/integrations/webhooks/ingest/route");
    expect((await POST(post(body, "nope"), { params: params() })).status).toBe(401);
  });

  it("treats a retried identical payload as the same batch", async () => {
    const { POST } = await import("@/app/api/orgs/[orgId]/integrations/webhooks/ingest/route");
    db.importBatch.findFirst.mockResolvedValue({ id: "b0", state: "committed" });
    const res = await POST(post(body), { params: params() });
    expect(res.status).toBe(200);
    expect((await res.json()).duplicate).toBe(true);
    expect(db.importBatch.create).not.toHaveBeenCalled();
  });

  it("refuses a locked or foreign reporting period", async () => {
    const { POST } = await import("@/app/api/orgs/[orgId]/integrations/webhooks/ingest/route");
    db.reportingPeriod.findFirst.mockResolvedValueOnce({ status: "locked" });
    expect((await POST(post(body), { params: params() })).status).toBe(409);
    db.reportingPeriod.findFirst.mockResolvedValueOnce(null);
    expect((await POST(post(body), { params: params() })).status).toBe(404);
  });

  it("writes only headers the importer recognises", () => {
    const header = recordsToCsv([]).split("\n")[0].split(",");
    const known = new Set(CANONICAL_FIELDS.map((f) => f.canonical));
    expect(header.filter((h) => !known.has(h))).toEqual([]);
  });
});
