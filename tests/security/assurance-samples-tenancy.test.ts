// @vitest-environment node
/** Assurance sample routes: another organisation's engagement, sample or evidence ids must 404 and write nothing. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

type Where = Record<string, unknown>;

const rows = vi.hoisted(() => ({
  engagements: [{ id: "eng-a", organizationId: "org-a", status: "fieldwork" }] as Where[],
  samples: [{ id: "smp-a", organizationId: "org-a", engagement: { status: "fieldwork" } }] as Where[],
  calcs: [{ id: "calc-a", organizationId: "org-a" }] as Where[],
  water: [{ id: "water-a", organizationId: "org-a" }] as Where[],
  waste: [{ id: "waste-a", organizationId: "org-a" }] as Where[],
}));

const find = (list: Where[]) => async ({ where }: { where: Where }) =>
  list.find((r) => Object.entries(where).every(([k, v]) => r[k] === v)) ?? null;

const db = vi.hoisted(() => ({
  assuranceEngagement: { findFirst: vi.fn() },
  assuranceSample: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  emissionCalculation: { findFirst: vi.fn() },
  waterRecord: { findFirst: vi.fn() },
  wasteRecord: { findFirst: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/security/org-refs", () => ({
  orgRefsError: vi.fn(async (orgId: string, refs: { activityRecordId?: string }) =>
    refs.activityRecordId === "rec-a" && orgId !== "org-a"
      ? NextResponse.json({ code: "NOT_FOUND" }, { status: 404 })
      : null,
  ),
}));
vi.mock("@/lib/auth/session", () => ({
  AuthError: class extends Error {},
  requireOrgMember: vi.fn(async () => ({ session: { user: { id: "user-b" } } })),
}));

import { PUT } from "@/app/api/orgs/[orgId]/assurance/engagements/[engagementId]/samples/route";
import { PATCH } from "@/app/api/orgs/[orgId]/assurance/samples/[sampleId]/route";

const manual = (orgId: string, extra: Record<string, unknown> = {}, engagementId = "eng-a") =>
  PUT(
    new NextRequest("http://localhost/x", {
      method: "PUT",
      body: JSON.stringify({
        samplingMethod: "random",
        selectionRationale: "r",
        testProcedure: "t",
        ...extra,
      }),
    }),
    { params: Promise.resolve({ orgId, engagementId }) },
  );

const patch = (orgId: string, sampleId = "smp-a") =>
  PATCH(
    new NextRequest("http://localhost/x", { method: "PATCH", body: JSON.stringify({ result: "pass" }) }),
    { params: Promise.resolve({ orgId, sampleId }) },
  );

beforeEach(() => {
  vi.clearAllMocks();
  db.assuranceEngagement.findFirst.mockImplementation(find(rows.engagements));
  db.assuranceSample.findFirst.mockImplementation(find(rows.samples));
  db.emissionCalculation.findFirst.mockImplementation(find(rows.calcs));
  db.waterRecord.findFirst.mockImplementation(find(rows.water));
  db.wasteRecord.findFirst.mockImplementation(find(rows.waste));
  db.assuranceSample.create.mockResolvedValue({ id: "new" });
  db.assuranceSample.update.mockResolvedValue({ id: "smp-a" });
});

describe("assurance samples tenancy", () => {
  it("PUT: org B naming org A's engagement gets 404, nothing created", async () => {
    expect((await manual("org-b")).status).toBe(404);
    expect(db.assuranceSample.create).not.toHaveBeenCalled();
  });

  it.each([
    ["emissionCalculationId", "calc-a"],
    ["waterRecordId", "water-a"],
    ["wasteRecordId", "waste-a"],
    ["activityRecordId", "rec-a"],
  ])("PUT: org B's own engagement with org A's %s is refused", async (field, id) => {
    rows.engagements.push({ id: "eng-b", organizationId: "org-b", status: "fieldwork" });
    const res = await manual("org-b", { [field]: id }, "eng-b");
    rows.engagements.pop();
    expect(res.status).toBe(404);
    expect(db.assuranceSample.create).not.toHaveBeenCalled();
  });

  it("PUT: control, org A with its own calculation creates the sample", async () => {
    const res = await manual("org-a", { emissionCalculationId: "calc-a" });
    expect(res.status).toBeLessThan(300);
    expect(db.assuranceSample.create).toHaveBeenCalledTimes(1);
  });

  it("PATCH: org B naming org A's sample gets 404, no update", async () => {
    expect((await patch("org-b")).status).toBe(404);
    expect(db.assuranceSample.update).not.toHaveBeenCalled();
  });

  it("PATCH: control, org A updates its own sample", async () => {
    expect((await patch("org-a")).status).toBeLessThan(300);
    expect(db.assuranceSample.update).toHaveBeenCalledTimes(1);
  });
});
