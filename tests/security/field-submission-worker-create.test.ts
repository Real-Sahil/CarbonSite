// @vitest-environment node
/** A field worker's new submission: evidence must be their own, and they cannot pick a facility. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  prisma: {
    facility: { findFirst: vi.fn() },
    evidenceFile: { count: vi.fn() },
    fieldSubmission: { create: vi.fn(), findUnique: vi.fn() },
  },
  session: { requireOrgMember: vi.fn(), ROLE_GROUPS: { reviewersAndEditors: ["admin", "editor", "reviewer"] } },
  writeAuditLog: vi.fn(),
  firstEvidenceMismatch: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: h.prisma }));
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: h.writeAuditLog }));
vi.mock("@/lib/auth/session", () => h.session);
vi.mock("@/lib/evidence/seal", () => ({ firstEvidenceMismatch: h.firstEvidenceMismatch, sealAfterApproval: vi.fn() }));
vi.mock("@/lib/jobs/dispatch", () => ({ dispatchNotification: vi.fn() }));
vi.mock("@/lib/billing/limits", () => ({
  requireActiveBilling: vi.fn(),
  requireFeature: vi.fn(),
  requireWithinUsageLimit: vi.fn(),
}));
vi.mock("@/lib/billing/usage", () => ({ recordUsage: vi.fn() }));
vi.mock("@/lib/geo/route-distance", () => ({ getOrCreateRouteDistance: vi.fn(), RouteDistanceError: class extends Error {} }));
vi.mock("@/lib/storage", () => ({ presignDownload: vi.fn() }));

import { POST } from "@/app/api/orgs/[orgId]/field-submissions/route";

const asRole = (role: string) =>
  h.session.requireOrgMember.mockResolvedValue({ session: { user: { id: "w1" } }, membership: { role } });

const submit = (body: unknown) =>
  POST(
    new NextRequest("http://localhost/api/orgs/org1/field-submissions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ orgId: "org1" }) },
  );

const base = { documentType: "waste_ticket", formData: { weight: 10, weightUnit: "kg" } };

beforeEach(() => {
  vi.resetAllMocks();
  asRole("field_worker");
  h.prisma.facility.findFirst.mockResolvedValue(null);
  h.prisma.evidenceFile.count.mockResolvedValue(0);
  h.firstEvidenceMismatch.mockResolvedValue(null);
});

describe("new submission by a field worker", () => {
  it("refuses a facility choice before any facility lookup", async () => {
    const res = await submit({ ...base, facilityId: "fac1" });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("FACILITY_NOT_ALLOWED");
    expect(h.prisma.facility.findFirst).not.toHaveBeenCalled();
    expect(h.prisma.fieldSubmission.create).not.toHaveBeenCalled();
  });

  it("answers evidence that is not the worker's with a 404, without checking the file", async () => {
    const res = await submit({ ...base, evidenceIds: ["ev-foreign"] });
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ code: "NOT_FOUND", message: "Evidence file not found." });
    expect(h.prisma.evidenceFile.count.mock.calls[0][0].where).toMatchObject({
      id: { in: ["ev-foreign"] },
      organizationId: "org1",
      OR: [
        { uploadedByUserId: "w1" },
        { submissionFiles: { some: { fieldSubmission: { submittedByUserId: "w1" } } } },
      ],
    });
    expect(h.firstEvidenceMismatch).not.toHaveBeenCalled();
    expect(h.prisma.fieldSubmission.create).not.toHaveBeenCalled();
  });
});

describe("new submission by an organisation member", () => {
  it("still checks a facility against the organisation", async () => {
    asRole("editor");
    const res = await submit({ ...base, facilityId: "fac1" });
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("INVALID_FACILITY");
    expect(h.prisma.facility.findFirst.mock.calls[0][0].where).toEqual({ id: "fac1", organizationId: "org1" });
  });

  it("keeps the organisation-wide evidence check and its 422", async () => {
    asRole("reviewer");
    const res = await submit({ ...base, evidenceIds: ["ev-other-org"] });
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("INVALID_EVIDENCE");
    expect(h.prisma.evidenceFile.count.mock.calls[0][0].where).not.toHaveProperty("OR");
  });
});
