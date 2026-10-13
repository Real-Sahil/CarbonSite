// @vitest-environment node
/**
 * The public supplier-data submit link can be forwarded or double-clicked, so two POSTs can race.
 * Only the first may write a SupplierReport. A flagged or rejected request stays open for the
 * supplier to resubmit (app/supplier-verify), so it must still accept a POST.
 */
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type Row = Record<string, unknown>;

const db = vi.hoisted(() => {
  const requests: Row[] = [];
  const matches = (row: Row, where: Row) => Object.entries(where).every(([k, v]) => row[k] === v);
  const find = (where: Row) => requests.find((r) => matches(r, where)) ?? null;
  return {
    requests,
    supplierDataRequest: {
      findUnique: vi.fn(async ({ where }: { where: Row }) => {
        const row = find(where);
        return row ? { ...row } : null;
      }),
      update: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
        const row = find(where);
        if (!row) throw new Error("no such supplier data request");
        Object.assign(row, data);
        return { ...row };
      }),
    },
    supplierReport: {
      create: vi.fn(async ({ data }: { data: Row }) => ({ id: "report-1", ...data })),
    },
    emissionCategory: { findUnique: vi.fn(async () => ({ id: "cat-1" })) },
    $transaction: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/security/rate-limit-async", () => ({ rateLimitRequest: vi.fn().mockResolvedValue(null) }));

import { POST as publicSubmit } from "@/app/api/public/supplier-data/[token]/submit/route";

const RAW = "raw-link-token-for-supplier-request-0000000000";
const SUBMIT = {
  totalAmount: 1200,
  unit: "tonnes",
  calculationMethod: "direct",
  emissionCategoryId: "s3-purchased-goods",
  reportingYear: 2025,
};
// Same digest as hashToken() in lib/management-systems/auditor-access.ts, computed here without importing it.
const sha = (token: string) => createHash("sha256").update(token, "utf8").digest("hex");

/** A request row with the fields the submit route reads. */
function addRequest(over: Row = {}) {
  db.requests.push({
    id: "req-a",
    organizationId: "org-a",
    supplierEmail: "sup@supplier.test",
    categoryCode: "s3-purchased-goods",
    reportingPeriod: { startDate: new Date(2025, 0, 1) },
    expiresAt: new Date(Date.now() + 86_400_000),
    status: "sent",
    tokenHash: sha(RAW),
    ...over,
  });
}

const submit = (token = RAW) =>
  publicSubmit(
    new NextRequest(`http://localhost/api/public/supplier-data/${token}/submit`, {
      method: "POST",
      body: JSON.stringify(SUBMIT),
      headers: { "content-type": "application/json" },
    }),
    { params: Promise.resolve({ token }) } as never,
  );

beforeEach(() => {
  vi.clearAllMocks();
  db.requests.length = 0;
  db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db));
});

describe("first submission", () => {
  it("writes one report and closes the request", async () => {
    addRequest();
    const res = await submit();
    expect(res.status).toBe(201);
    expect(db.supplierReport.create).toHaveBeenCalledTimes(1);
    expect(db.supplierReport.create.mock.calls[0][0].data).toMatchObject({
      supplierDataRequestId: "req-a",
      status: "submitted",
    });
    expect(db.requests[0]).toMatchObject({ status: "submitted" });
  });

  it("checks and writes in one Serializable transaction", async () => {
    addRequest();
    await submit();
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
  });
});

describe("duplicate POSTs", () => {
  it("a POST after a committed submission is refused and writes nothing", async () => {
    addRequest();
    expect((await submit()).status).toBe(201);
    const again = await submit();
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ code: "ALREADY_PROCESSED" });
    expect(db.supplierReport.create).toHaveBeenCalledTimes(1);
  });

  it("a POST whose check passed before another POST committed writes nothing", async () => {
    addRequest();
    // The other POST commits after this one's pre-check and before its transaction starts.
    db.$transaction.mockImplementationOnce((fn: (tx: typeof db) => unknown) => {
      db.requests[0].status = "submitted";
      return fn(db);
    });
    const res = await submit();
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "ALREADY_PROCESSED" });
    expect(db.supplierReport.create).not.toHaveBeenCalled();
    expect(db.supplierDataRequest.update).not.toHaveBeenCalled();
  });

  it("a write conflict (P2034) from the losing transaction answers 409, not 500", async () => {
    addRequest();
    db.$transaction.mockRejectedValueOnce(
      Object.assign(new Error("Transaction failed due to a write conflict or a deadlock"), { code: "P2034" }),
    );
    const res = await submit();
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "ALREADY_PROCESSED" });
  });

  it("any other transaction failure is still a 500", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    addRequest();
    db.$transaction.mockRejectedValueOnce(new Error("connection reset"));
    const res = await submit();
    consoleError.mockRestore();
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ code: "INTERNAL_ERROR" });
  });
});

describe("which statuses accept a submission", () => {
  it("a flagged request stays open for the supplier to resubmit", async () => {
    addRequest({ status: "flagged" });
    expect((await submit()).status).toBe(201);
    expect(db.requests[0]).toMatchObject({ status: "submitted" });
  });

  it.each(["submitted", "approved", "converted", "rejected"])("a %s request is closed to new submissions", async (status) => {
    addRequest({ status });
    expect((await submit()).status).toBe(409);
    expect(db.supplierReport.create).not.toHaveBeenCalled();
  });
});
