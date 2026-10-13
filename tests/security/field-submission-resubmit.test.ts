// @vitest-environment node
/** Resubmission gets the same worker rules as a new submission: site, evidence, billing and usage. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  prisma: {
    fieldSubmission: { findUnique: vi.fn(), create: vi.fn() },
    fieldWorkerSiteAssignment: { findUnique: vi.fn() },
    evidenceFile: { count: vi.fn() },
  },
  session: { requireOrgMember: vi.fn(), ROLE_GROUPS: { reviewersAndEditors: ["admin", "editor", "reviewer"] } },
  writeAuditLog: vi.fn(),
  billing: { requireActiveBilling: vi.fn(), requireFeature: vi.fn(), requireWithinUsageLimit: vi.fn() },
  recordUsage: vi.fn(),
  fuelSubmissionError: vi.fn(),
  safetySubmissionError: vi.fn(),
  socialValueSubmissionError: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: h.prisma }));
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: h.writeAuditLog }));
vi.mock("@/lib/auth/session", () => h.session);
vi.mock("@/lib/billing/limits", () => h.billing);
vi.mock("@/lib/billing/usage", () => ({ recordUsage: h.recordUsage }));
vi.mock("@/lib/field-submissions/fuel-capture", () => ({ fuelSubmissionError: h.fuelSubmissionError }));
vi.mock("@/lib/field-submissions/safety-capture", () => ({ safetySubmissionError: h.safetySubmissionError }));
vi.mock("@/lib/social-value/field-capture", () => ({ socialValueSubmissionError: h.socialValueSubmissionError, SocialValueApprovalError: class SocialValueApprovalError extends Error {} }));

import { POST } from "@/app/api/orgs/[orgId]/field-submissions/[submissionId]/resubmit/route";

const original = () => ({
  organizationId: "org1",
  status: "rejected",
  reportingPeriodId: "p1",
  emissionCategoryId: "cat1",
  facilityId: "fac1",
  siteId: "site1",
  contractId: null,
  documentType: "waste_ticket",
  submittedByUserId: "w1",
});

const asRole = (role: string) =>
  h.session.requireOrgMember.mockResolvedValue({ session: { user: { id: "w1" } }, membership: { role } });

const resubmit = (body: unknown) =>
  POST(
    new NextRequest("http://localhost/api/orgs/org1/field-submissions/orig1/resubmit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ orgId: "org1", submissionId: "orig1" }) },
  );

const formData = { weight: 10, weightUnit: "kg" };
const workerEvidenceOr = [
  { uploadedByUserId: "w1" },
  { submissionFiles: { some: { fieldSubmission: { submittedByUserId: "w1" } } } },
];

beforeEach(() => {
  vi.resetAllMocks();
  asRole("field_worker");
  h.prisma.fieldSubmission.findUnique.mockResolvedValue(original());
  h.prisma.fieldSubmission.create.mockResolvedValue({ id: "new1", status: "submitted" });
  h.prisma.fieldWorkerSiteAssignment.findUnique.mockResolvedValue({ id: "a1" });
  h.prisma.evidenceFile.count.mockResolvedValue(1);
  h.billing.requireActiveBilling.mockResolvedValue(null);
  h.billing.requireFeature.mockResolvedValue(null);
  h.billing.requireWithinUsageLimit.mockResolvedValue(null);
  h.recordUsage.mockResolvedValue(undefined);
  h.writeAuditLog.mockResolvedValue(undefined);
  h.safetySubmissionError.mockResolvedValue(null);
  h.fuelSubmissionError.mockResolvedValue(null);
  h.socialValueSubmissionError.mockResolvedValue(null);
});

describe("resubmit as a field worker", () => {
  it("keeps the site, attaches the worker's own evidence and records one usage", async () => {
    const res = await resubmit({ formData, evidenceFileIds: ["ev-own"] });
    expect(res.status).toBe(201);
    expect(h.prisma.fieldSubmission.create.mock.calls[0][0].data).toMatchObject({
      organizationId: "org1",
      siteId: "site1",
      submittedByUserId: "w1",
      resubmittedFromId: "orig1",
      files: { create: [{ evidenceFileId: "ev-own" }] },
    });
    expect(h.recordUsage).toHaveBeenCalledWith({ organizationId: "org1", eventType: "field_submission.submitted" });
  });

  it("answers evidence that is not the worker's with the same 404 as a missing file", async () => {
    h.prisma.evidenceFile.count.mockResolvedValue(0);
    const res = await resubmit({ formData, evidenceFileIds: ["ev-foreign"] });
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ code: "NOT_FOUND", message: "Evidence file not found." });
    expect(h.prisma.evidenceFile.count.mock.calls[0][0].where).toMatchObject({
      id: { in: ["ev-foreign"] },
      organizationId: "org1",
      OR: workerEvidenceOr,
    });
    expect(h.prisma.fieldSubmission.create).not.toHaveBeenCalled();
    expect(h.recordUsage).not.toHaveBeenCalled();
  });

  it("refuses a site the worker is not assigned to before any evidence is read", async () => {
    h.prisma.fieldWorkerSiteAssignment.findUnique.mockResolvedValue(null);
    const res = await resubmit({ formData, evidenceFileIds: ["ev-own"] });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("SITE_NOT_ASSIGNED");
    expect(h.prisma.fieldWorkerSiteAssignment.findUnique.mock.calls[0][0].where).toEqual({
      organizationId_userId_siteId: { organizationId: "org1", userId: "w1", siteId: "site1" },
    });
    expect(h.prisma.evidenceFile.count).not.toHaveBeenCalled();
    expect(h.prisma.fieldSubmission.create).not.toHaveBeenCalled();
  });

  it("does not create the resubmission once the plan's usage limit is reached", async () => {
    h.billing.requireWithinUsageLimit.mockResolvedValue(new Response(null, { status: 402 }));
    const res = await resubmit({ formData });
    expect(res.status).toBe(402);
    expect(h.billing.requireWithinUsageLimit).toHaveBeenCalledWith("org1", "field_submission.submitted");
    expect(h.prisma.fieldSubmission.create).not.toHaveBeenCalled();
    expect(h.recordUsage).not.toHaveBeenCalled();
  });

  it("does not create the resubmission while billing is inactive", async () => {
    h.billing.requireActiveBilling.mockResolvedValue(new Response(null, { status: 402 }));
    const res = await resubmit({ formData });
    expect(res.status).toBe(402);
    expect(h.prisma.fieldSubmission.create).not.toHaveBeenCalled();
    expect(h.recordUsage).not.toHaveBeenCalled();
  });

  it("returns the first resubmission on a retry, with no second usage check or charge", async () => {
    h.prisma.fieldSubmission.findUnique
      .mockResolvedValueOnce(original())
      .mockResolvedValueOnce({ id: "new1", status: "submitted" });
    const res = await resubmit({ formData, idempotencyKey: "k1" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: "new1" });
    expect(h.billing.requireWithinUsageLimit).not.toHaveBeenCalled();
    expect(h.prisma.fieldSubmission.create).not.toHaveBeenCalled();
    expect(h.recordUsage).not.toHaveBeenCalled();
  });
});

describe("resubmit as an organisation member", () => {
  it("keeps the organisation-wide evidence check and skips the worker's site rule", async () => {
    asRole("reviewer");
    h.prisma.evidenceFile.count.mockResolvedValue(0);
    const res = await resubmit({ formData, evidenceFileIds: ["ev-other-org"] });
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("INVALID_EVIDENCE");
    expect(h.prisma.fieldWorkerSiteAssignment.findUnique).not.toHaveBeenCalled();
    expect(h.prisma.evidenceFile.count.mock.calls[0][0].where).not.toHaveProperty("OR");
  });
});
