// @vitest-environment node
/** Approval and reject races, reviewer edits and bulk review: one decision per submission, and a failed row never half-commits. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => {
  const tx = {
    fieldSubmission: { updateMany: vi.fn(), update: vi.fn() },
    activityRecord: { create: vi.fn() },
    reviewTask: { create: vi.fn() },
  };
  return {
    tx,
    prisma: {
      fieldSubmission: { findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
      emissionCategory: { findUnique: vi.fn() },
      organizationMembership: { findUnique: vi.fn(), findFirst: vi.fn() },
      reviewTask: { findMany: vi.fn() },
      $transaction: vi.fn(),
    },
    session: { requireOrgMember: vi.fn(), ROLE_GROUPS: { reviewersAndEditors: ["admin", "editor", "reviewer"] } },
    writeAuditLog: vi.fn(),
    sealAfterApproval: vi.fn(),
    firstEvidenceMismatch: vi.fn(),
    dispatchNotification: vi.fn(),
    scheduleCalculationForPeriod: vi.fn(),
    orgRefsError: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({ prisma: h.prisma }));
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: h.writeAuditLog }));
vi.mock("@/lib/auth/session", () => h.session);
vi.mock("@/lib/evidence/seal", () => ({ firstEvidenceMismatch: h.firstEvidenceMismatch, sealAfterApproval: h.sealAfterApproval }));
vi.mock("@/lib/jobs/dispatch", () => ({ dispatchNotification: h.dispatchNotification, dispatchSupplierPerformanceUpdate: vi.fn() }));
vi.mock("@/lib/field-submissions/trigger-calculation", () => ({ scheduleCalculationForPeriod: h.scheduleCalculationForPeriod }));
vi.mock("@/lib/security/org-refs", () => ({ orgRefsError: h.orgRefsError }));

import { PATCH as reviewPatch } from "@/app/api/orgs/[orgId]/field-submissions/[submissionId]/review/route";
import { PATCH as bulkPatch } from "@/app/api/orgs/[orgId]/field-submissions/bulk-review/route";
import { approvalBlocker } from "@/lib/field-submissions/approve";

const submission = (over: Record<string, unknown> = {}) => ({
  id: "cs1aaaaaaaa",
  organizationId: "org1",
  status: "submitted",
  documentType: "fuel_receipt",
  formData: { volume: 10, volumeUnit: "litres" },
  ocrExtractedData: null,
  emissionCategoryId: "cat1",
  facilityId: "fac1",
  reportingPeriodId: "p1",
  siteId: null,
  contractId: null,
  submittedByUserId: "w1",
  activityRecordId: null,
  files: [],
  ...over,
});

const jsonRequest = (url: string, body: unknown) =>
  new NextRequest(url, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const reviewCtx = { params: Promise.resolve({ orgId: "org1", submissionId: "cs1aaaaaaaa" }) };
const bulkCtx = { params: Promise.resolve({ orgId: "org1" }) };
const review = (body: unknown) =>
  reviewPatch(jsonRequest("http://localhost/api/orgs/org1/field-submissions/cs1aaaaaaaa/review", body), reviewCtx);
const bulk = (body: unknown) =>
  bulkPatch(jsonRequest("http://localhost/api/orgs/org1/field-submissions/bulk-review", body), bulkCtx);

beforeEach(() => {
  vi.resetAllMocks();
  h.session.requireOrgMember.mockResolvedValue({ session: { user: { id: "rev1" } }, membership: { role: "editor" } });
  h.prisma.$transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === "function" ? (arg as (t: typeof h.tx) => unknown)(h.tx) : Promise.all(arg as Promise<unknown>[]),
  );
  h.prisma.emissionCategory.findUnique.mockResolvedValue({ id: "cat1" });
  h.prisma.organizationMembership.findFirst.mockResolvedValue(null);
  h.prisma.reviewTask.findMany.mockResolvedValue([]);
  h.orgRefsError.mockResolvedValue(null);
  h.firstEvidenceMismatch.mockResolvedValue(null);
  h.sealAfterApproval.mockResolvedValue(undefined);
  h.writeAuditLog.mockResolvedValue(undefined);
  h.dispatchNotification.mockResolvedValue(undefined);
  h.scheduleCalculationForPeriod.mockResolvedValue(undefined);
  h.tx.fieldSubmission.updateMany.mockResolvedValue({ count: 1 });
  h.tx.fieldSubmission.update.mockResolvedValue({ id: "cs1aaaaaaaa", status: "approved" });
  h.tx.activityRecord.create.mockResolvedValue({ id: "ar1" });
  h.tx.reviewTask.create.mockResolvedValue({ id: "t1" });
});

describe("approvalBlocker", () => {
  it("names the facility a water meter reading needs, instead of failing later", () => {
    const reading = submission({ documentType: "water_meter_reading", formData: { reading: 5, readingUnit: "m3" }, emissionCategoryId: null, facilityId: null });
    expect(approvalBlocker(reading as never, null, null)).toEqual({
      code: "MISSING_FACILITY",
      message: "Assign a facility before approving this water meter reading.",
    });
    expect(approvalBlocker(reading as never, null, "fac1")).toBeNull();
  });
});

describe("single review", () => {
  it("an approval that loses the claim is a 409 and writes no record", async () => {
    h.prisma.fieldSubmission.findFirst.mockResolvedValue(submission());
    h.tx.fieldSubmission.updateMany.mockResolvedValue({ count: 0 });
    const res = await review({ action: "approved" });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("CONFLICT");
    expect(h.tx.fieldSubmission.updateMany.mock.calls[0][0].where).toEqual({
      id: "cs1aaaaaaaa",
      organizationId: "org1",
      status: { notIn: ["approved", "rejected"] },
    });
    expect(h.tx.activityRecord.create).not.toHaveBeenCalled();
    expect(h.tx.fieldSubmission.update).not.toHaveBeenCalled();
    expect(h.writeAuditLog).not.toHaveBeenCalled();
  });

  it("a reviewer edit that leaves no positive amount is refused before any write", async () => {
    h.prisma.fieldSubmission.findFirst.mockResolvedValue(submission());
    const res = await review({ action: "approved", formData: { volume: 0, volumeUnit: "litres" } });
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("INVALID_FORM_DATA");
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("a reject that loses to an approval is a 409 and overwrites nothing", async () => {
    h.prisma.fieldSubmission.findFirst.mockResolvedValue(submission());
    h.prisma.fieldSubmission.updateMany.mockResolvedValue({ count: 0 });
    const res = await review({ action: "rejected" });
    expect(res.status).toBe(409);
    expect(h.prisma.fieldSubmission.updateMany.mock.calls[0][0].where).toMatchObject({ status: { notIn: ["approved", "rejected"] } });
    expect(h.prisma.fieldSubmission.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(h.writeAuditLog).not.toHaveBeenCalled();
  });
});

describe("bulk review", () => {
  it("a row that fails is skipped and the other rows still approve", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    h.prisma.fieldSubmission.findMany.mockResolvedValue([submission({ id: "cs1aaaaaaaa" }), submission({ id: "cs1bbbbbbbb" })]);
    h.tx.fieldSubmission.updateMany.mockRejectedValueOnce(new Error("connection reset")).mockResolvedValueOnce({ count: 1 });
    const res = await bulk({ ids: ["cs1aaaaaaaa", "cs1bbbbbbbb"], action: "approve" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      updated: 1,
      ids: ["cs1bbbbbbbb"],
      skipped: [{ id: "cs1aaaaaaaa", reason: "Could not be approved. Try again." }],
    });
    expect(h.tx.activityRecord.create).toHaveBeenCalledTimes(1);
  });

  it("a row another review decided first is skipped, not approved twice", async () => {
    h.prisma.fieldSubmission.findMany.mockResolvedValue([submission({ id: "cs1aaaaaaaa" }), submission({ id: "cs1bbbbbbbb" })]);
    h.tx.fieldSubmission.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
    const res = await bulk({ ids: ["cs1aaaaaaaa", "cs1bbbbbbbb"], action: "approve" });
    expect(await res.json()).toEqual({
      updated: 1,
      ids: ["cs1bbbbbbbb"],
      skipped: [{ id: "cs1aaaaaaaa", reason: "Submission is already resolved." }],
    });
    expect(h.tx.activityRecord.create).toHaveBeenCalledTimes(1);
  });

  it("a reject leaves a row another review decided alone and rejects the rest", async () => {
    h.prisma.fieldSubmission.findMany.mockResolvedValue([submission({ id: "cs1aaaaaaaa" }), submission({ id: "cs1bbbbbbbb" })]);
    h.prisma.fieldSubmission.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
    const res = await bulk({ ids: ["cs1aaaaaaaa", "cs1bbbbbbbb"], action: "reject" });
    expect(await res.json()).toEqual({
      updated: 1,
      ids: ["cs1bbbbbbbb"],
      skipped: [{ id: "cs1aaaaaaaa", reason: "Submission is already resolved." }],
    });
    expect(h.prisma.fieldSubmission.updateMany.mock.calls[0][0].where).toEqual({
      id: "cs1aaaaaaaa",
      organizationId: "org1",
      status: { notIn: ["approved", "rejected"] },
    });
    expect(h.writeAuditLog).toHaveBeenCalledTimes(1);
  });

  it("a viewer cannot be given a review task", async () => {
    h.prisma.fieldSubmission.findMany.mockResolvedValue([submission({ id: "cs1aaaaaaaa" })]);
    h.prisma.organizationMembership.findUnique.mockResolvedValue({ role: "viewer" });
    const res = await bulk({ ids: ["cs1aaaaaaaa"], action: "assign", assigneeUserId: "u2" });
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("INVALID_ASSIGNEE");
    expect(h.tx.reviewTask.create).not.toHaveBeenCalled();
  });

  it("a submission that already has an open review task is skipped, not given a second one", async () => {
    h.prisma.fieldSubmission.findMany.mockResolvedValue([submission({ id: "cs1aaaaaaaa" }), submission({ id: "cs1bbbbbbbb" })]);
    h.prisma.organizationMembership.findUnique.mockResolvedValue({ role: "reviewer" });
    h.prisma.reviewTask.findMany.mockResolvedValue([{ targetId: "cs1aaaaaaaa" }]);
    const res = await bulk({ ids: ["cs1aaaaaaaa", "cs1bbbbbbbb"], action: "assign", assigneeUserId: "u2" });
    expect(await res.json()).toEqual({
      updated: 1,
      ids: ["cs1bbbbbbbb"],
      skipped: [{ id: "cs1aaaaaaaa", reason: "Already has an open review task." }],
    });
    expect(h.tx.reviewTask.create).toHaveBeenCalledTimes(1);
    expect(h.tx.reviewTask.create.mock.calls[0][0].data).toMatchObject({ targetId: "cs1bbbbbbbb", assigneeUserId: "u2" });
  });
});
