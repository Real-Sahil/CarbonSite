// @vitest-environment node
/**
 * Supplier data request links are stored only as a SHA-256 of the link token
 * (`token_hash`). These tests run the routes that issue and accept links against
 * a small in-memory request table. Every lookup has to match on the hash, so a
 * link that is wrong, expired, or belongs to another request is refused, and
 * the portal and resend routes never hand back a raw token or a hash.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type Row = Record<string, unknown>;

const db = vi.hoisted(() => {
  const requests: Row[] = [];
  let seq = 0;
  const matches = (row: Row, where: Row) => Object.entries(where).every(([k, v]) => row[k] === v);
  const find = (where: Row) => requests.find((r) => matches(r, where)) ?? null;
  return {
    requests,
    supplierDataRequest: {
      findUnique: vi.fn(async ({ where }: { where: Row }) => {
        const row = find(where);
        return row ? { ...row } : null;
      }),
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async ({ where }: { where: Row }) => requests.filter((r) => matches(r, where)).map((r) => ({ ...r }))),
      create: vi.fn(async ({ data }: { data: Row }) => {
        // Fields the routes read back through their includes, as Prisma would return them.
        const row: Row = {
          id: `new-${++seq}`,
          status: "sent",
          sentAt: new Date(),
          organization: { name: "Org A Ltd" },
          reportingPeriod: { label: "FY2025", startDate: new Date("2025-01-01"), endDate: new Date("2025-12-31") },
          createdBy: { name: "Admin A", email: "a@org-a.test" },
          ...data,
        };
        requests.push(row);
        return { ...row };
      }),
      update: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
        const row = find(where);
        if (!row) throw new Error("no such supplier data request");
        Object.assign(row, data);
        return { ...row };
      }),
    },
    reportingPeriod: { findFirst: vi.fn(), findUnique: vi.fn() },
    organization: { findUnique: vi.fn() },
    emissionCategory: { findUnique: vi.fn() },
    supplierReport: { create: vi.fn() },
    $transaction: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/security/rate-limit-async", () => ({ rateLimitRequest: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/notifications/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  supplierDataRequestEmail: vi.fn().mockReturnValue({ subject: "Request", html: "<p>Request</p>", text: "Request" }),
}));
vi.mock("@/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/session")>();
  const ctx = { session: { user: { id: "admin-a", name: "Admin A", email: "a@org-a.test" } }, membership: {} };
  return {
    ...actual,
    requireSession: vi.fn().mockResolvedValue(ctx.session),
    requireOrgMember: vi.fn().mockResolvedValue(ctx),
  };
});

import { sendEmail, supplierDataRequestEmail } from "@/lib/notifications/email";
import { POST as createRequests } from "@/app/api/orgs/[orgId]/supplier-data-requests/route";
import { POST as bulkRequests } from "@/app/api/orgs/[orgId]/supplier-data-requests/bulk/route";
import { GET as formGet, POST as formPost } from "@/app/api/supplier-data/[token]/route";
import { GET as guidanceGet } from "@/app/api/supplier-data/[token]/guidance/route";
import { GET as validateGet } from "@/app/api/public/supplier-data/[token]/validate/route";
import { POST as publicSubmit } from "@/app/api/public/supplier-data/[token]/submit/route";
import { GET as portalList } from "@/app/api/supplier-portal/requests/route";
import { POST as portalResend } from "@/app/api/supplier-portal/requests/[requestId]/resend/route";

const ORG_A = "org-a";
const SUPPLIER = "sup@supplier.test";
const PERIOD = { label: "FY2025", startDate: new Date("2025-01-01"), endDate: new Date("2025-12-31") };
const FORM = { totalAmount: 1200, unit: "kWh", notes: "Annual electricity", supplierName: "Supplier Ltd" };
const SUBMIT = { totalAmount: 1200, unit: "tonnes", calculationMethod: "direct", emissionCategoryId: "s3-purchased-goods", reportingYear: 2025 };

// The SQL backfill computes encode(sha256(convert_to(token, 'UTF8')), 'hex'). This is the same digest, computed independently of hashToken().
const sha = (token: string) => createHash("sha256").update(token, "utf8").digest("hex");
const future = () => new Date(Date.now() + 86_400_000);

const RAW_A = "raw-link-token-for-request-a-0000000000000000";
const RAW_B = "raw-link-token-for-request-b-0000000000000000";
const RAW_C = "raw-link-token-for-other-supplier-00000000000";

/** A request row. Defaults to the shape the app writes now: hash only, no plaintext. */
function addRequest(id: string, over: Row = {}) {
  db.requests.push({
    id,
    organizationId: ORG_A,
    reportingPeriodId: "p-a",
    supplierEmail: SUPPLIER,
    supplierName: "Supplier Ltd",
    categoryCode: "s3-purchased-goods",
    status: "sent",
    sentAt: new Date(),
    submittedAt: null,
    expiresAt: future(),
    notes: null,
    createdByUserId: "admin-a",
    token: null,
    tokenHash: null,
    reportingPeriod: PERIOD,
    organization: { name: "Org A Ltd" },
    createdBy: { name: "Admin A", email: "a@org-a.test" },
    ...over,
  });
}

const get = (url: string) => new NextRequest(`http://localhost${url}`);
const post = (url: string, body: unknown) =>
  new NextRequest(`http://localhost${url}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
const ctx = (params: Record<string, string>) => ({ params: Promise.resolve(params) }) as never;
const lastSegment = (url: string) => new URL(url).pathname.split("/").pop() ?? "";
const emailedLink = (call = 0) => lastSegment(vi.mocked(supplierDataRequestEmail).mock.calls[call][0].formUrl as string);

beforeEach(() => {
  vi.clearAllMocks();
  db.requests.length = 0;
  db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db));
  db.reportingPeriod.findFirst.mockResolvedValue({ id: "p-a", label: PERIOD.label });
  db.reportingPeriod.findUnique.mockResolvedValue(PERIOD);
  db.organization.findUnique.mockResolvedValue({ name: "Org A Ltd" });
  db.emissionCategory.findUnique.mockResolvedValue({ id: "c1" });
  db.supplierReport.create.mockResolvedValue({ id: "sr1" });
});

describe("new links are stored as hashes only", () => {
  it.each([
    [
      "single send",
      "/api/orgs/org-a/supplier-data-requests",
      () => createRequests(
        post("/api/orgs/org-a/supplier-data-requests", {
          reportingPeriodId: "p-a",
          suppliers: [{ email: SUPPLIER, name: "Supplier Ltd" }],
          categoryCode: "s3-purchased-goods",
        }),
        ctx({ orgId: ORG_A }),
      ),
    ],
    [
      "bulk CSV",
      "/api/orgs/org-a/supplier-data-requests/bulk",
      () => bulkRequests(
        post("/api/orgs/org-a/supplier-data-requests/bulk", {
          csvContent: `email,name\n${SUPPLIER},Supplier Ltd\n`,
          reportingPeriodId: "p-a",
          categoryCode: "s3-purchased-goods",
        }),
        ctx({ orgId: ORG_A }),
      ),
    ],
  ])("%s stores the SHA-256 of the emailed token and no plaintext", async (_name, _url, send) => {
    const res = await send();
    expect(res.status).toBe(201);

    const stored = db.requests[0];
    const raw = emailedLink();
    expect(raw.length).toBeGreaterThanOrEqual(40);
    expect(stored.tokenHash).toBe(sha(raw));
    expect(db.supplierDataRequest.create.mock.calls[0][0].data).not.toHaveProperty("token");
    expect(stored.token ?? null).toBeNull();
    expect(JSON.stringify(db.requests)).not.toContain(raw);
  });

  it("the emailed link opens the request it was issued for", async () => {
    await createRequests(
      post("/api/orgs/org-a/supplier-data-requests", {
        reportingPeriodId: "p-a",
        suppliers: [{ email: SUPPLIER }],
        categoryCode: "s3-purchased-goods",
      }),
      ctx({ orgId: ORG_A }),
    );
    const raw = emailedLink();
    const res = await formGet(get(`/api/supplier-data/${raw}`), ctx({ token: raw }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "sent" });
  });
});

describe("links from before the change still resolve", () => {
  it("a backfilled row (plaintext kept, hash written by the migration) accepts a submission", async () => {
    addRequest("req-legacy", { token: RAW_A, tokenHash: sha(RAW_A) });

    const res = await formPost(post(`/api/supplier-data/${RAW_A}`, FORM), ctx({ token: RAW_A }));
    expect(res.status).toBe(200);
    expect(db.supplierReport.create).toHaveBeenCalledTimes(1);
    expect(db.supplierDataRequest.update.mock.calls[0][0].where).toEqual({ id: "req-legacy" });
  });

  it("a row whose hash was never written does not fall back to its plaintext token", async () => {
    addRequest("req-unhashed", { token: RAW_A, tokenHash: null });

    expect((await validateGet(get(`/api/public/supplier-data/${RAW_A}/validate`), ctx({ token: RAW_A }))).status).toBe(404);
    expect((await publicSubmit(post(`/api/public/supplier-data/${RAW_A}/submit`, SUBMIT), ctx({ token: RAW_A }))).status).toBe(404);
    expect(db.supplierDataRequest.findUnique.mock.calls.every(([arg]) => Object.keys(arg.where)[0] === "tokenHash")).toBe(true);
    expect(db.supplierReport.create).not.toHaveBeenCalled();
  });
});

describe("wrong, expired and cross-request links are refused", () => {
  const link = (t: string) => [
    ["supplier form POST", () => formPost(post(`/api/supplier-data/${t}`, FORM), ctx({ token: t }))],
    ["supplier form GET", () => formGet(get(`/api/supplier-data/${t}`), ctx({ token: t }))],
    ["guidance GET", () => guidanceGet(get(`/api/supplier-data/${t}/guidance`), ctx({ token: t }))],
    ["validate GET", () => validateGet(get(`/api/public/supplier-data/${t}/validate`), ctx({ token: t }))],
    ["public submit POST", () => publicSubmit(post(`/api/public/supplier-data/${t}/submit`, SUBMIT), ctx({ token: t }))],
  ] as const;

  it.each(link("x").map(([name]) => [name]))("%s answers 404 for a token that matches no request", async (name) => {
    addRequest("req-a", { tokenHash: sha(RAW_A) });
    const route = link("not-a-real-token").find(([n]) => n === name)!;
    expect((await route[1]()).status).toBe(404);
    expect(db.supplierReport.create).not.toHaveBeenCalled();
    expect(db.supplierDataRequest.update).not.toHaveBeenCalled();
  });

  it.each([
    ["supplier form POST", () => formPost(post(`/api/supplier-data/${RAW_A}`, FORM), ctx({ token: RAW_A }))],
    ["public submit POST", () => publicSubmit(post(`/api/public/supplier-data/${RAW_A}/submit`, SUBMIT), ctx({ token: RAW_A }))],
    ["validate GET", () => validateGet(get(`/api/public/supplier-data/${RAW_A}/validate`), ctx({ token: RAW_A }))],
  ])("%s answers 410 for an expired link and writes nothing", async (_name, send) => {
    addRequest("req-old", { tokenHash: sha(RAW_A), expiresAt: new Date(Date.now() - 1_000) });
    expect((await send()).status).toBe(410);
    expect(db.supplierReport.create).not.toHaveBeenCalled();
    expect(db.supplierDataRequest.update).not.toHaveBeenCalled();
  });

  it("a link for request A cannot submit to request B, even if the body names B", async () => {
    addRequest("req-a", { tokenHash: sha(RAW_A) });
    addRequest("req-b", { tokenHash: sha(RAW_B) });

    const res = await publicSubmit(
      post(`/api/public/supplier-data/${RAW_A}/submit`, { ...SUBMIT, requestId: "req-b", supplierDataRequestId: "req-b" }),
      ctx({ token: RAW_A }),
    );
    expect(res.status).toBe(201);
    expect(db.supplierReport.create.mock.calls[0][0].data).toMatchObject({ supplierDataRequestId: "req-a" });
    const updates = db.supplierDataRequest.update.mock.calls.map(([arg]) => arg.where.id);
    expect(updates).toEqual(["req-a"]);
    expect(db.requests.find((r) => r.id === "req-b")?.status).toBe("sent");
  });
});

describe("the supplier portal never returns a link token or hash", () => {
  it("lists every request of the supplier without the raw tokens or their hashes", async () => {
    addRequest("req-a", { token: RAW_A, tokenHash: sha(RAW_A) });
    addRequest("req-b", { token: RAW_B, tokenHash: sha(RAW_B), reportingPeriodId: "p-b", categoryCode: "s3-business-travel", reportingPeriod: { label: "FY2026", startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") } });
    addRequest("req-c", { token: RAW_C, tokenHash: sha(RAW_C), supplierEmail: "other@supplier.test" });

    const res = await portalList(get(`/api/supplier-portal/requests?token=${RAW_A}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    const text = JSON.stringify(body);

    expect(body.requests.map((r: { id: string }) => r.id)).toEqual(["req-a", "req-b"]);
    for (const secret of [RAW_A, RAW_B, RAW_C, sha(RAW_A), sha(RAW_B), sha(RAW_C)]) {
      expect(text).not.toContain(secret);
    }
    expect(body.requests.some((r: Row) => "token" in r || "tokenHash" in r)).toBe(false);
    const select = db.supplierDataRequest.findMany.mock.calls[0][0].select as Row;
    expect(select).not.toHaveProperty("token");
    expect(select).not.toHaveProperty("tokenHash");
  });

  it("looks the caller up by hash, so a plaintext-only row is refused", async () => {
    addRequest("req-a", { token: RAW_A, tokenHash: null });
    const res = await portalList(get(`/api/supplier-portal/requests?token=${RAW_A}`));
    expect(res.status).toBe(401);
    expect(db.supplierDataRequest.findUnique.mock.calls[0][0].where).toEqual({ tokenHash: sha(RAW_A) });
  });
});

describe("resend keeps the link the supplier presented and rotates otherwise", () => {
  const resend = (requestId: string, token: string) =>
    portalResend(post(`/api/supplier-portal/requests/${requestId}/resend`, { token }), ctx({ requestId }));

  it("resending with the request's own link sends that same link and keeps its hash", async () => {
    addRequest("req-b", { tokenHash: sha(RAW_B), reportingPeriodId: "p-b" });

    const res = await resend("req-b", RAW_B);
    expect(res.status).toBe(200);
    expect(emailedLink()).toBe(RAW_B);

    const update = db.supplierDataRequest.update.mock.calls[0][0].data;
    expect(update).not.toHaveProperty("tokenHash");
    expect(update).not.toHaveProperty("token");
    expect(db.requests.find((r) => r.id === "req-b")?.tokenHash).toBe(sha(RAW_B));
  });

  it("resending with another request's link issues a new link and the old one stops working", async () => {
    addRequest("req-a", { tokenHash: sha(RAW_A) });
    addRequest("req-b", { tokenHash: sha(RAW_B), reportingPeriodId: "p-b" });

    const res = await resend("req-b", RAW_A);
    expect(res.status).toBe(200);

    const fresh = emailedLink();
    expect(fresh).not.toBe(RAW_A);
    expect(fresh).not.toBe(RAW_B);
    const update = db.supplierDataRequest.update.mock.calls[0][0].data;
    expect(update).toMatchObject({ status: "sent", tokenHash: sha(fresh), token: null });
    expect(JSON.stringify(db.requests)).not.toContain(fresh);

    expect((await formGet(get(`/api/supplier-data/${RAW_B}`), ctx({ token: RAW_B }))).status).toBe(404);
    expect((await formGet(get(`/api/supplier-data/${fresh}`), ctx({ token: fresh }))).status).toBe(200);
  });

  it("a link belonging to another supplier cannot resend the request", async () => {
    addRequest("req-a", { tokenHash: sha(RAW_A) });
    addRequest("req-c", { tokenHash: sha(RAW_C), supplierEmail: "other@supplier.test" });

    const res = await resend("req-a", RAW_C);
    expect(res.status).toBe(403);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(db.supplierDataRequest.update).not.toHaveBeenCalled();
  });
});

describe("migration 20261016000102 backfills and keeps the plaintext column", () => {
  const migrationDir = join(process.cwd(), "prisma", "migrations", "20261016000102_hash_supplier_data_tokens");
  const sql = readFileSync(join(migrationDir, "migration.sql"), "utf8");

  it("adds token_hash, backfills it from the stored token and indexes it", () => {
    expect(sql).toMatch(/ADD COLUMN\s+"token_hash" TEXT/);
    expect(sql).toMatch(
      /UPDATE "supplier_data_requests"\s+SET "token_hash" = encode\(sha256\(convert_to\("token", 'UTF8'\)\), 'hex'\)\s+WHERE "token" IS NOT NULL AND "token_hash" IS NULL;/,
    );
    expect(sql).toContain('CREATE UNIQUE INDEX "supplier_data_requests_token_hash_key" ON "supplier_data_requests"("token_hash");');
  });

  it("never drops the plaintext column in this release", () => {
    expect(sql).not.toMatch(/DROP\s+COLUMN/i);
    expect(sql).not.toMatch(/SET\s+NOT\s+NULL/i);
  });

  it("maps the schema field to the column the migration creates", () => {
    const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");
    expect(schema).toMatch(/tokenHash\s+String\?\s+@unique @map\("token_hash"\)/);
  });
});
