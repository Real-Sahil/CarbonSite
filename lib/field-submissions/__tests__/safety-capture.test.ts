// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const model = () => ({ findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]), count: vi.fn(), create: vi.fn(), update: vi.fn() });
  return new Proxy({} as Record<string, ReturnType<typeof model>>, { get: (t, k: string) => (t[k] ??= model()) });
});
vi.mock("@/lib/db", () => ({ prisma: db }));

import { approveHazardInTx, approveInspectionInTx, hazardEntry, inspectionEntry, safetySubmissionError, SafetyApprovalError } from "../safety-capture";
import { approvalBlocker } from "../approve";
import { SocialValueApprovalError } from "@/lib/social-value/field-capture";

const tx = db as unknown as Parameters<typeof approveHazardInTx>[0];
const submission = (formData: object) => ({ id: "sub-12345678", formData, siteId: "site-1", facilityId: null, submittedByUserId: "fw-1", deviceSubmittedAt: new Date("2026-09-20T10:00:00Z"), createdAt: new Date("2026-09-20T10:05:00Z") });

beforeEach(() => {
  vi.clearAllMocks();
  for (const m of [db.msCorrectiveAction, db.hsIncidentReport, db.msInspection]) m.create.mockImplementation(async ({ data }: { data: object }) => ({ id: "new-1", ...data }));
});

describe("parsing", () => {
  it("needs a kind and a description for a hazard report", () => {
    expect(hazardEntry({ kind: "near_miss", description: "  Excavator swung close to banksman " })).toEqual({
      entry: { kind: "near_miss", description: "Excavator swung close to banksman", location: null, immediateAction: null, observedOn: null },
    });
    expect("error" in hazardEntry({ kind: "gossip", description: "x" })).toBe(true);
    expect("error" in hazardEntry({ kind: "hazard" })).toBe(true);
  });

  it("needs a checklist, a place and valid results for an inspection, accepting results sent as JSON text", () => {
    const ok = inspectionEntry({ templateId: "t1", location: "Compound", results: JSON.stringify([{ item: "Spill kit stocked", result: "fail", note: "Empty" }]) });
    expect("entry" in ok && ok.entry.results[0]).toEqual({ item: "Spill kit stocked", result: "fail", note: "Empty" });
    expect("error" in inspectionEntry({ templateId: "t1", location: "Compound", results: [{ item: "x", result: "maybe" }] })).toBe(true);
    expect("error" in inspectionEntry({ location: "Compound", results: [] })).toBe(true);
  });

  it("checks the checklist is the organisation's and every item is on it", async () => {
    db.msInspectionTemplate.findFirst.mockResolvedValue(null);
    expect(await safetySubmissionError("org-a", "site_inspection", { templateId: "t-other", location: "Compound", results: [{ item: "A", result: "pass" }] })).toBe("That checklist was not found.");
    expect(db.msInspectionTemplate.findFirst.mock.calls[0][0].where).toEqual({ id: "t-other", organizationId: "org-a" });
    db.msInspectionTemplate.findFirst.mockResolvedValue({ items: "A\nB" });
    expect(await safetySubmissionError("org-a", "site_inspection", { templateId: "t1", location: "Compound", results: [{ item: "C", result: "pass" }] })).toContain("not on the checklist");
    expect(await safetySubmissionError("org-a", "site_inspection", { templateId: "t1", location: "Compound", results: [{ item: "A", result: "pass" }] })).toBeNull();
  });

  it("does not ask for a category or amount before approval", () => {
    const base = { id: "s", documentType: "hazard_report", formData: { kind: "hazard", description: "Open trench unfenced" }, ocrExtractedData: null } as unknown as Parameters<typeof approvalBlocker>[0];
    expect(approvalBlocker(base, null, null)).toBeNull();
    expect(approvalBlocker({ ...base, formData: {} } as typeof base, null, null)?.code).toBe("INVALID_FORM_DATA");
  });
});

describe("approval", () => {
  it("turns a near miss into an incident report and a corrective action in the organisation", async () => {
    db.hsIncidentReport.findFirst.mockResolvedValue(null);
    const out = await approveHazardInTx(tx, { orgId: "org-a", submission: submission({ kind: "near_miss", description: "Load swung over walkway", location: "Gate 2", observedOn: "2026-09-19" }), reviewerUserId: "rev-1" });
    expect(out.incidentId).toBe("new-1");
    expect(db.hsIncidentReport.create.mock.calls[0][0].data).toMatchObject({ organizationId: "org-a", incidentType: "near_miss", reference: "FS-12345678", fieldSubmissionId: "sub-12345678", siteId: "site-1" });
    expect(db.msCorrectiveAction.create.mock.calls[0][0].data).toMatchObject({ organizationId: "org-a", source: "incident", title: "Near miss reported on site: Load swung over walkway" });
  });

  it("turns a hazard into a corrective action only", async () => {
    await approveHazardInTx(tx, { orgId: "org-a", submission: submission({ kind: "unsafe_condition", description: "Handrail missing" }), reviewerUserId: "rev-1" });
    expect(db.hsIncidentReport.create).not.toHaveBeenCalled();
    expect(db.msCorrectiveAction.create).toHaveBeenCalledTimes(1);
  });

  it("records an inspection and one corrective action for its failed items", async () => {
    db.msInspectionTemplate.findFirst.mockResolvedValue({ id: "t1", items: "Spill kit stocked\nWheel wash working" });
    const out = await approveInspectionInTx(tx, {
      orgId: "org-a",
      submission: submission({ templateId: "t1", location: "Compound", inspectedOn: "2026-09-20", results: [{ item: "Spill kit stocked", result: "fail", note: "Empty" }, { item: "Wheel wash working", result: "pass" }] }),
      reviewerUserId: "rev-1",
    });
    expect(out.correctiveActionId).toBe("new-1");
    expect(db.msInspection.create.mock.calls[0][0].data).toMatchObject({ organizationId: "org-a", templateId: "t1", status: "actions_open", inspectorUserId: "fw-1", correctiveActionId: "new-1" });
    expect(db.msInspectionTemplate.findFirst.mock.calls[0][0].where).toEqual({ id: "t1", organizationId: "org-a" });
  });

  it("refuses an inspection whose checklist has gone, with an error every approval path turns into a 422", async () => {
    db.msInspectionTemplate.findFirst.mockResolvedValue(null);
    const run = approveInspectionInTx(tx, { orgId: "org-a", submission: submission({ templateId: "t1", location: "Compound", results: [{ item: "A", result: "pass" }] }), reviewerUserId: "rev-1" });
    await expect(run).rejects.toBeInstanceOf(SafetyApprovalError);
    await expect(run).rejects.toBeInstanceOf(SocialValueApprovalError);
  });
});
