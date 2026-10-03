// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => {
  const model = () => ({ findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() });
  return {
    organizationMembership: model(),
    user: model(),
    evidenceFile: model(),
    msCompetence: model(),
    msTrainingRecord: model(),
    msEquipment: model(),
    msToolboxTalk: model(),
    msToolboxDelivery: model(),
    msFleetVehicle: model(),
    msInspectionTemplate: model(),
    msInspection: model(),
    msCorrectiveAction: model(),
    msDocument: model(),
    msPolicy: model(),
    msAcknowledgement: model(),
    msEvidenceLink: model(),
    msReminderLog: model(),
    msRequirementStatus: model(),
    msFrameworkAdoption: model(),
    hsIncidentReport: model(),
    msRisk: model(),
    msInterestedParty: model(),
    msChange: model(),
    msObjective: model(),
    msAudit: model(),
    msAuditFinding: model(),
    msComplaint: model(),
    msNonconformity: model(),
    msSupplierEvaluation: model(),
    msManagementReview: model(),
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  };
});
const dispatchNotification = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/jobs/dispatch", () => ({ dispatchNotification }));
vi.mock("@/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/session")>();
  const ctx = { session: { user: { id: "user-a" } }, membership: { role: "admin" } };
  return { ...actual, requireSession: vi.fn().mockResolvedValue(ctx.session), requireOrgMember: vi.fn().mockResolvedValue(ctx) };
});

import { REGISTERS } from "../registers/config";
import { applyRules, checklistItems, registerSchema } from "../registers/server";
import { EVIDENCE_RECORD_KINDS } from "../access";
import { RECORD_KINDS } from "../evidence";
import { reminderStage } from "../reminders";
import { cellState, trainingMatrix } from "../training";

const req = (body: unknown, method = "POST") =>
  new NextRequest("http://localhost/x", { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const listParams = (register: string) => ({ params: Promise.resolve({ orgId: "org-a", register }) });
const rowParams = (register: string, id: string) => ({ params: Promise.resolve({ orgId: "org-a", register, id }) });
const d = (s: string) => new Date(`${s}T00:00:00Z`);

beforeEach(() => {
  vi.clearAllMocks();
  for (const m of Object.values(db)) {
    if (typeof m !== "object" || !("create" in m)) continue;
    m.create.mockImplementation(async ({ data }: { data: object }) => ({ id: "new-1", ...data }));
    m.update.mockImplementation(async ({ data }: { data: object }) => ({ id: "row-1", ...data }));
  }
});

describe("register definitions", () => {
  it("lists every register's evidence kind as linkable evidence", () => {
    const kinds = Object.values(REGISTERS).map((r) => r.evidenceKind);
    for (const k of kinds) {
      expect(EVIDENCE_RECORD_KINDS).toContain(k);
      expect(RECORD_KINDS).toContain(k);
    }
  });

  it("points row fields at registers that exist and reminders at date fields", () => {
    for (const r of Object.values(REGISTERS)) {
      for (const f of r.fields) if (f.type === "row") expect(REGISTERS[f.ref!], `${r.key}.${f.name}`).toBeDefined();
      for (const rem of r.reminders ?? []) expect(r.fields.find((f) => f.name === rem.field)?.type, `${r.key}.${rem.field}`).toBe("date");
    }
  });

  it("validates numbers, files and checklist results", () => {
    expect(registerSchema("objectives", "create").safeParse({ title: "Cut AFR", target: 0.1 }).success).toBe(true);
    expect(registerSchema("objectives", "create").safeParse({ title: "Cut AFR", target: "0.1" }).success).toBe(false);
    const insp = registerSchema("inspections", "create");
    expect(insp.safeParse({ templateId: "t1", location: "Depot", results: [{ item: "Spill kit stocked", result: "fail", note: "Empty" }] }).success).toBe(true);
    expect(insp.safeParse({ templateId: "t1", location: "Depot", results: [{ item: "Spill kit", result: "maybe" }] }).success).toBe(false);
  });

  it("starts a new draft version when an approved document's file changes", () => {
    const existing = { id: "d1", title: "Spill procedure", fileId: "f1", status: "approved", version: 1 };
    expect(applyRules("documents", existing, { fileId: "f2" }, "user-a").data).toMatchObject({ status: "draft", version: 2, approvedByUserId: null });
    expect(applyRules("documents", { ...existing, status: "draft" }, { status: "approved" }, "user-a").data).toMatchObject({ approvedByUserId: "user-a" });
  });

  it("reads checklist items one per line, dropping bullets and numbering", () => {
    expect(checklistItems("1. Spill kit stocked\n- Waste segregated\n\n* Waste segregated\nNo idling plant")).toEqual(["Spill kit stocked", "Waste segregated", "No idling plant"]);
  });
});

describe("register writes", () => {
  it("works out a training record's expiry from the competence and takes the name from the user", async () => {
    const { POST } = await import("@/app/api/orgs/[orgId]/management-systems/registers/[register]/route");
    db.msCompetence.findFirst.mockResolvedValue({ id: "c1", validityMonths: 60 });
    db.organizationMembership.findFirst.mockResolvedValue({ id: "m1" });
    db.user.findFirst.mockResolvedValue({ name: "Priya Shah", email: "p@x.test" });
    const res = await POST(req({ competenceId: "c1", personUserId: "u2", completedOn: "2024-03-01" }), listParams("training-records"));
    expect(res.status).toBe(201);
    expect(db.msTrainingRecord.create.mock.calls[0][0].data).toMatchObject({ personName: "Priya Shah", expiresOn: d("2029-03-01"), organizationId: "org-a" });
    expect(db.msCompetence.findFirst.mock.calls[0][0].where).toMatchObject({ id: "c1", organizationId: "org-a" });
  });

  it("refuses a competence, file or person from another organisation", async () => {
    const { POST } = await import("@/app/api/orgs/[orgId]/management-systems/registers/[register]/route");
    db.msCompetence.findFirst.mockResolvedValue(null);
    expect((await POST(req({ competenceId: "c-other", personName: "A N Other" }), listParams("training-records"))).status).toBe(404);
    db.msCompetence.findFirst.mockResolvedValue({ id: "c1" });
    db.evidenceFile.findFirst.mockResolvedValue(null);
    expect((await POST(req({ competenceId: "c1", personName: "A N Other", fileId: "f-other" }), listParams("training-records"))).status).toBe(404);
    expect(db.evidenceFile.findFirst.mock.calls[0][0].where).toEqual({ id: "f-other", organizationId: "org-a" });
    expect(db.msTrainingRecord.create).not.toHaveBeenCalled();
  });

  it("works out equipment's next check from the last one and the interval", async () => {
    const { POST } = await import("@/app/api/orgs/[orgId]/management-systems/registers/[register]/route");
    await POST(req({ name: "Noise meter", lastCheckedOn: "2026-01-15", intervalMonths: 12 }), listParams("equipment"));
    expect(db.msEquipment.create.mock.calls[0][0].data.nextDueOn).toEqual(d("2027-01-15"));
  });

  it("raises one corrective action for an inspection's failed items and refuses items not on the checklist", async () => {
    const { POST } = await import("@/app/api/orgs/[orgId]/management-systems/registers/[register]/route");
    db.msInspectionTemplate.findFirst.mockResolvedValue({ id: "t1", items: "Spill kit stocked\nWaste segregated\nWheel wash working" });
    db.msInspection.create.mockImplementation(async ({ data }: { data: object }) => ({ id: "i1", ...data }));
    const results = [
      { item: "Spill kit stocked", result: "fail", note: "Empty" },
      { item: "Waste segregated", result: "pass" },
      { item: "Wheel wash working", result: "fail" },
    ];
    const res = await POST(req({ templateId: "t1", location: "Leeds depot", inspectedOn: "2026-09-20", results }), listParams("inspections"));
    expect(res.status).toBe(201);
    const ca = db.msCorrectiveAction.create.mock.calls[0][0].data;
    expect(ca).toMatchObject({ organizationId: "org-a", source: "inspection", title: "Inspection at Leeds depot: 2 items failed" });
    expect(ca.description).toContain("Spill kit stocked: Empty");
    expect(db.msInspection.create.mock.calls[0][0].data.status).toBe("actions_open");
    expect(db.msInspection.update.mock.calls[0][0]).toMatchObject({ where: { id: "i1" }, data: { correctiveActionId: "new-1" } });

    const bad = await POST(req({ templateId: "t1", location: "Depot", results: [{ item: "Made up", result: "pass" }] }), listParams("inspections"));
    expect(bad.status).toBe(422);
  });

  it("will not delete a competence that training records use", async () => {
    const { DELETE } = await import("@/app/api/orgs/[orgId]/management-systems/registers/[register]/[id]/route");
    db.msCompetence.findFirst.mockResolvedValue({ id: "c1", title: "SMSTS" });
    db.msTrainingRecord.findFirst.mockResolvedValue({ id: "r1" });
    expect((await DELETE(req(undefined, "DELETE"), rowParams("competences", "c1"))).status).toBe(409);
    expect(db.msTrainingRecord.findFirst.mock.calls[0][0].where).toEqual({ organizationId: "org-a", competenceId: "c1" });
    expect(db.msCompetence.delete).not.toHaveBeenCalled();
  });
});

describe("acknowledgements", () => {
  it("records a read of the current approved version once, and refuses drafts", async () => {
    const { POST } = await import("@/app/api/orgs/[orgId]/management-systems/registers/[register]/[id]/acknowledge/route");
    db.msDocument.findFirst.mockResolvedValue({ id: "d1", status: "approved", version: 3 });
    db.msAcknowledgement.findUnique.mockResolvedValue(null);
    db.msAcknowledgement.create.mockImplementation(async ({ data }: { data: object }) => ({ id: "a1", acknowledgedAt: new Date(), ...data }));
    expect((await POST(req({}), rowParams("documents", "d1"))).status).toBe(201);
    expect(db.msAcknowledgement.create.mock.calls[0][0].data).toEqual({ organizationId: "org-a", registerKey: "documents", rowId: "d1", version: 3, userId: "user-a" });
    expect(db.msDocument.findFirst.mock.calls[0][0].where).toEqual({ id: "d1", organizationId: "org-a" });

    db.msDocument.findFirst.mockResolvedValue({ id: "d1", status: "draft", version: 4 });
    expect((await POST(req({}), rowParams("documents", "d1"))).status).toBe(409);
    expect((await POST(req({}), rowParams("risks", "r1"))).status).toBe(404);
  });
});

describe("reminders", () => {
  it("is due soon within 14 days and overdue after the date", () => {
    expect(reminderStage(d("2026-10-10"), d("2026-09-27"))).toBe("due_soon");
    expect(reminderStage(d("2026-10-20"), d("2026-09-27"))).toBeNull();
    expect(reminderStage(d("2026-09-26"), d("2026-09-27"))).toBe("overdue");
  });

  it("sends each reminder once, to the owner, or to editors when there is no owner", async () => {
    const { processManagementSystemReminders } = await import("../reminders");
    for (const m of Object.values(db)) if (typeof m === "object" && "findMany" in m) m.findMany.mockResolvedValue([]);
    db.msCorrectiveAction.findMany.mockResolvedValue([
      { id: "ca1", organizationId: "org-a", title: "Fix bund", dueOn: d("2026-09-20"), ownerUserId: "owner-1", status: "open" },
      { id: "ca2", organizationId: "org-a", title: "Train drivers", dueOn: d("2026-10-01"), ownerUserId: null, status: "open" },
    ]);
    db.msReminderLog.findUnique.mockResolvedValue(null);
    db.organizationMembership.findFirst.mockResolvedValue({ userId: "owner-1" });
    db.organizationMembership.findMany.mockResolvedValue([{ userId: "ed-1" }, { userId: "ed-2" }]);

    expect(await processManagementSystemReminders(d("2026-09-27"))).toBe(2);
    const calls = dispatchNotification.mock.calls.map((c) => [c[0].recipientUserId, c[0].metadata.stage]);
    expect(calls).toEqual([["owner-1", "overdue"], ["ed-1", "due_soon"], ["ed-2", "due_soon"]]);
    expect(db.msReminderLog.create).toHaveBeenCalledTimes(2);

    dispatchNotification.mockClear();
    db.msReminderLog.findUnique.mockResolvedValue({ id: "logged" });
    expect(await processManagementSystemReminders(d("2026-09-27"))).toBe(0);
    expect(dispatchNotification).not.toHaveBeenCalled();
  });
});

describe("training matrix", () => {
  const today = d("2026-09-27");
  it("marks expired, expiring and valid, keeping the latest record per person", () => {
    expect(cellState(d("2026-09-01"), today)).toBe("expired");
    expect(cellState(d("2026-11-01"), today)).toBe("expiring");
    expect(cellState(d("2027-06-01"), today)).toBe("valid");
    expect(cellState(null, today)).toBe("no_expiry");

    const { rows, totals } = trainingMatrix(
      [{ id: "cscs", title: "CSCS", validityMonths: 60 }, { id: "sm", title: "SMSTS", validityMonths: 60 }],
      [
        { id: "r1", competenceId: "cscs", personUserId: null, personName: "Tom Reed", employer: "Groundco", completedOn: d("2020-01-01"), expiresOn: d("2025-01-01") },
        { id: "r2", competenceId: "cscs", personUserId: null, personName: "tom reed ", employer: "Groundco", completedOn: d("2025-01-02"), expiresOn: d("2030-01-02") },
        { id: "r3", competenceId: "sm", personUserId: "u1", personName: "Ana Silva", employer: null, completedOn: d("2021-10-20"), expiresOn: d("2026-10-20") },
      ],
      today,
    );
    expect(rows.map((r) => r.name)).toEqual(["Ana Silva", "Tom Reed"]);
    expect(rows[1].cells.cscs).toMatchObject({ recordId: "r2", state: "valid" });
    expect(totals).toEqual({ expired: 0, expiring: 1 });
  });
});

describe("toolbox talk and fleet registers", () => {
  it("starts a new draft version when an approved talk's content changes, and not when it is retired", () => {
    const existing = { id: "t1", status: "approved", version: 2, content: "Old", title: "Working at height" };
    expect(applyRules("toolbox-talks", existing, { content: "New" }, "u").data).toMatchObject({ status: "draft", version: 3 });
    expect(applyRules("toolbox-talks", existing, { content: "New", status: "retired" }, "u").data.version).toBeUndefined();
    expect(applyRules("toolbox-talks", existing, { reviewOn: new Date() }, "u").data.status).toBeUndefined();
  });

  it("needs a talk, a date and a place to record a delivery, and refuses a talk from another organisation", async () => {
    const { POST } = await import("@/app/api/orgs/[orgId]/management-systems/registers/[register]/route");
    expect((await POST(req({ deliveredOn: "2026-10-01" }), listParams("toolbox-deliveries"))).status).toBe(422);
    db.msToolboxTalk.findFirst.mockResolvedValue(null);
    expect((await POST(req({ talkId: "talk-of-org-b", deliveredOn: "2026-10-01", location: "Site 4" }), listParams("toolbox-deliveries"))).status).toBe(404);
    expect(db.msToolboxTalk.findFirst.mock.calls[0][0].where).toEqual({ id: "talk-of-org-b", organizationId: "org-a" });
    expect(db.msToolboxDelivery.create).not.toHaveBeenCalled();
  });

  it("saves a vehicle under the organisation in the URL and rejects an unknown powertrain", async () => {
    const { POST } = await import("@/app/api/orgs/[orgId]/management-systems/registers/[register]/route");
    expect((await POST(req({ registration: "AB12 CDE", powertrain: "steam" }), listParams("fleet-vehicles"))).status).toBe(422);
    db.msFleetVehicle.create.mockImplementation(async ({ data }: { data: object }) => ({ id: "v1", ...data }));
    const res = await POST(req({ registration: "AB12 CDE", powertrain: "bev" }), listParams("fleet-vehicles"));
    expect(res.status).toBe(201);
    expect(db.msFleetVehicle.create.mock.calls[0][0].data).toMatchObject({ organizationId: "org-a", registration: "AB12 CDE", powertrain: "bev" });
  });
});
