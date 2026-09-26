// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => {
  const model = () => ({ findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn(), delete: vi.fn(), groupBy: vi.fn() });
  return {
    organizationMembership: model(),
    organization: model(),
    msFrameworkAdoption: model(),
    msRequirementStatus: model(),
    msEvidenceLink: model(),
    evidenceFile: model(),
    environmentalPermit: model(),
    hsIncidentReport: model(),
  };
});
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/session")>();
  const ctx = { session: { user: { id: "user-a" } }, membership: { role: "admin" } };
  return { ...actual, requireSession: vi.fn().mockResolvedValue(ctx.session), requireOrgMember: vi.fn().mockResolvedValue(ctx) };
});

const req = (body: unknown, method = "POST") =>
  new NextRequest("http://localhost/x", { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const params = (code: string) => ({ params: Promise.resolve({ orgId: "org-a", slug: "iso-14001-2015", code: encodeURIComponent(code) }) });

beforeEach(() => {
  vi.clearAllMocks();
  db.msFrameworkAdoption.findUnique.mockResolvedValue({ id: "adopt-1" });
  db.msEvidenceLink.count.mockResolvedValue(0);
  db.msEvidenceLink.create.mockImplementation(async ({ data }) => ({ id: "link-1", ...data }));
  db.msRequirementStatus.upsert.mockImplementation(async ({ create }) => ({ id: "st-1", ...create }));
});

describe("evidence links", () => {
  it("refuses another organisation's record, looking it up inside the caller's organisation", async () => {
    const { POST } = await import("@/app/api/orgs/[orgId]/management-systems/[slug]/requirements/[code]/evidence/route");
    db.environmentalPermit.findFirst.mockResolvedValue(null); // exists only in org B
    const res = await POST(req({ kind: "environmental_permit", targetId: "permit-of-org-b" }), params("6.1.3"));
    expect(res.status).toBe(404);
    expect(db.environmentalPermit.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "permit-of-org-b", organizationId: "org-a" } }));
    expect(db.msEvidenceLink.create).not.toHaveBeenCalled();
  });

  it("links the organisation's own record with its current title", async () => {
    const { POST } = await import("@/app/api/orgs/[orgId]/management-systems/[slug]/requirements/[code]/evidence/route");
    db.environmentalPermit.findFirst.mockResolvedValue({ title: "Mobile plant permit", reference: "EPR/AB1234" });
    const res = await POST(req({ kind: "environmental_permit", targetId: "permit-a" }), params("6.1.3"));
    expect(res.status).toBe(201);
    expect(db.msEvidenceLink.create.mock.calls[0][0].data).toMatchObject({ organizationId: "org-a", requirementCode: "6.1.3", label: "Mobile plant permit (EPR/AB1234)" });
  });

  it("refuses a javascript: link", async () => {
    const { POST } = await import("@/app/api/orgs/[orgId]/management-systems/[slug]/requirements/[code]/evidence/route");
    const res = await POST(req({ kind: "url", url: "javascript:alert(1)", label: "x" }), params("5.2"));
    expect(res.status).toBe(422);
  });

  it("refuses evidence on a heading or before the framework is adopted", async () => {
    const { POST } = await import("@/app/api/orgs/[orgId]/management-systems/[slug]/requirements/[code]/evidence/route");
    expect((await POST(req({ kind: "note", label: "x" }), params("9.2"))).status).toBe(404);
    db.msFrameworkAdoption.findUnique.mockResolvedValue(null);
    expect((await POST(req({ kind: "note", label: "x" }), params("9.2.2"))).status).toBe(404);
  });

  it("only deletes a link inside the caller's organisation", async () => {
    const { DELETE } = await import("@/app/api/orgs/[orgId]/management-systems/[slug]/requirements/[code]/evidence/[linkId]/route");
    db.msEvidenceLink.findFirst.mockResolvedValue(null);
    const res = await DELETE(req({}, "DELETE"), { params: Promise.resolve({ orgId: "org-a", slug: "iso-14001-2015", code: "5.2", linkId: "link-of-org-b" }) });
    expect(res.status).toBe(404);
    expect(db.msEvidenceLink.findFirst.mock.calls[0][0].where).toMatchObject({ id: "link-of-org-b", organizationId: "org-a" });
    expect(db.msEvidenceLink.delete).not.toHaveBeenCalled();
  });
});

describe("requirement status", () => {
  it("refuses an owner who is not a member of the organisation", async () => {
    const { PUT } = await import("@/app/api/orgs/[orgId]/management-systems/[slug]/requirements/[code]/route");
    db.organizationMembership.findFirst.mockResolvedValue(null);
    const res = await PUT(req({ ownerUserId: "user-of-org-b" }, "PUT"), params("6.1.2"));
    expect(res.status).toBe(404);
    expect(db.msRequirementStatus.upsert).not.toHaveBeenCalled();
  });

  it("asks why a requirement does not apply", async () => {
    const { PUT } = await import("@/app/api/orgs/[orgId]/management-systems/[slug]/requirements/[code]/route");
    db.msRequirementStatus.findUnique.mockResolvedValue(null);
    expect((await PUT(req({ status: "not_applicable" }, "PUT"), params("8.2"))).status).toBe(422);
    expect((await PUT(req({ status: "not_applicable", notes: "No emergency scenarios: office only" }, "PUT"), params("8.2"))).status).toBe(200);
  });

  it("refuses headings and unknown codes", async () => {
    const { PUT } = await import("@/app/api/orgs/[orgId]/management-systems/[slug]/requirements/[code]/route");
    expect((await PUT(req({ status: "implemented" }, "PUT"), params("9.2"))).status).toBe(422);
    expect((await PUT(req({ status: "implemented" }, "PUT"), params("99.9"))).status).toBe(404);
  });

  it("scopes the saved row to the caller's organisation", async () => {
    const { PUT } = await import("@/app/api/orgs/[orgId]/management-systems/[slug]/requirements/[code]/route");
    const res = await PUT(req({ status: "implemented", dueOn: "2027-01-31" }, "PUT"), params("6.1.2"));
    expect(res.status).toBe(200);
    expect(db.msRequirementStatus.upsert.mock.calls[0][0].where).toEqual({
      organizationId_frameworkSlug_requirementCode: { organizationId: "org-a", frameworkSlug: "iso-14001-2015", requirementCode: "6.1.2" },
    });
  });
});

describe("guidance review", () => {
  it("records who reviewed MetricOra's guidance against the current catalogue, and can withdraw it", async () => {
    const { PATCH } = await import("@/app/api/orgs/[orgId]/management-systems/[slug]/route");
    const { catalogueFingerprint, getFramework } = await import("../catalogue");
    db.msFrameworkAdoption.findUnique.mockResolvedValue({ id: "adopt-1" });
    db.msFrameworkAdoption.update.mockImplementation(async ({ data }) => ({ id: "adopt-1", status: "implementing", ...data }));
    const p = { params: Promise.resolve({ orgId: "org-a", slug: "iso-14001-2015" }) };

    expect((await PATCH(req({ guidanceReviewed: true, guidanceReviewNote: "Checked against our copy" }, "PATCH"), p)).status).toBe(200);
    expect(db.msFrameworkAdoption.update.mock.calls[0][0].data).toMatchObject({
      guidanceReviewedByUserId: "user-a",
      guidanceReviewNote: "Checked against our copy",
      guidanceReviewedVersion: catalogueFingerprint(getFramework("iso-14001-2015")!),
    });

    await PATCH(req({ guidanceReviewed: false }, "PATCH"), p);
    expect(db.msFrameworkAdoption.update.mock.calls[1][0].data).toMatchObject({ guidanceReviewedByUserId: null, guidanceReviewedVersion: null });
  });

  it("changes the fingerprint when MetricOra's guidance changes, so an old review shows as out of date", async () => {
    const { catalogueFingerprint, getFramework } = await import("../catalogue");
    const f = getFramework("iso-14001-2015")!;
    const edited = { ...f, requirements: f.requirements.map((r) => (r.code === "6.1.2" ? { ...r, guidance: `${r.guidance} Updated.` } : r)) };
    expect(catalogueFingerprint(edited)).not.toBe(catalogueFingerprint(f));
    expect(catalogueFingerprint(f)).toBe(catalogueFingerprint(getFramework("iso-14001-2015")!));
  });

  it("saves the organisation's own interpretation on a requirement", async () => {
    const { PUT } = await import("@/app/api/orgs/[orgId]/management-systems/[slug]/requirements/[code]/route");
    const res = await PUT(req({ interpretation: "Applies to our depot only; sites are covered by client permits." }, "PUT"), params("6.1.3"));
    expect(res.status).toBe(200);
    expect(db.msRequirementStatus.upsert.mock.calls[0][0].create).toMatchObject({ organizationId: "org-a", interpretation: expect.stringContaining("depot only") });
  });
});

describe("plan limit on adopted frameworks", () => {
  const p = { params: Promise.resolve({ orgId: "org-a" }) };

  it("refuses a second framework on Starter, counting only frameworks not withdrawn in the caller's organisation", async () => {
    const { POST } = await import("@/app/api/orgs/[orgId]/management-systems/route");
    db.organization.findUnique.mockResolvedValue({ plan: "starter", isPilot: false });
    db.msFrameworkAdoption.findUnique.mockResolvedValue(null);
    db.msFrameworkAdoption.count.mockResolvedValue(1);
    const res = await POST(req({ frameworkSlug: "iso-45001-2018" }), p);
    expect(res.status).toBe(402);
    expect((await res.json()).code).toBe("PLAN_LIMIT_REACHED");
    expect(db.msFrameworkAdoption.count.mock.calls[0][0].where).toEqual({ organizationId: "org-a", status: { not: "withdrawn" } });
    expect(db.msFrameworkAdoption.create).not.toHaveBeenCalled();
  });

  it("allows a framework already adopted, and pilots, without counting", async () => {
    const { POST } = await import("@/app/api/orgs/[orgId]/management-systems/route");
    db.organization.findUnique.mockResolvedValue({ plan: "starter", isPilot: false });
    db.msFrameworkAdoption.findUnique.mockResolvedValue({ id: "adopt-1", status: "implementing" });
    db.msFrameworkAdoption.update.mockResolvedValue({ id: "adopt-1", status: "implementing" });
    expect((await POST(req({ frameworkSlug: "iso-14001-2015" }), p)).status).toBe(200);
    expect(db.msFrameworkAdoption.count).not.toHaveBeenCalled();

    db.organization.findUnique.mockResolvedValue({ plan: "starter", isPilot: true });
    db.msFrameworkAdoption.findUnique.mockResolvedValue(null);
    db.msFrameworkAdoption.create.mockResolvedValue({ id: "adopt-2" });
    expect((await POST(req({ frameworkSlug: "iso-45001-2018" }), p)).status).toBe(201);
  });
});
