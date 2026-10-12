// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  subcontractorCarbonSubmission: { findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
}));
const mail = vi.hoisted(() => ({ sendEmail: vi.fn(), subcontractorReminderEmail: vi.fn() }));
const audit = vi.hoisted(() => ({ writeAuditLog: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/db/audit", () => audit);
vi.mock("@/lib/notifications/email", () => mail);
vi.mock("@/lib/observability", () => ({
  getLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { hashToken } from "@/lib/management-systems/auditor-access";
import { MAX_REMINDERS, REMINDER_LOOKBACK_DAYS, REMINDER_NOTICE_DAYS } from "@/lib/subcontractor/deadline";
import { REMINDER_BATCH, processSubcontractorReminders } from "@/lib/subcontractor/reminders";

const NOW = new Date("2026-11-20T09:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const UTC_TODAY = new Date("2026-11-20T00:00:00Z").getTime();

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub-1",
    organizationId: "org-a",
    status: "requested",
    contactEmail: "sam@groundworks.test",
    subcontractorName: "Groundworks Ltd",
    reportingPeriodLabel: "FY2026",
    dueDate: new Date("2026-11-25T00:00:00Z"),
    reminderCount: 0,
    lastReminderAt: null,
    linkSentAt: new Date("2026-11-01T10:00:00Z"),
    organization: { name: "Org A" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.subcontractorCarbonSubmission.findMany.mockResolvedValue([row()]);
  db.subcontractorCarbonSubmission.updateMany.mockResolvedValue({ count: 1 });
  db.subcontractorCarbonSubmission.update.mockResolvedValue({});
  mail.sendEmail.mockResolvedValue(undefined);
  mail.subcontractorReminderEmail.mockReturnValue({ subject: "Reminder", html: "<p>r</p>", text: "r" });
});

describe("processSubcontractorReminders: who is selected", () => {
  it("reads only open requests with a contact and a sent link, inside the window, under the cap, in batches", async () => {
    await processSubcontractorReminders(NOW);

    const { where, orderBy, take } = db.subcontractorCarbonSubmission.findMany.mock.calls[0][0];
    expect(where.status).toEqual({ in: ["requested", "overdue"] });
    expect(where.contactEmail).toEqual({ not: null });
    expect(where.linkSentAt).toEqual({ not: null });
    expect(where.reminderCount).toEqual({ lt: MAX_REMINDERS });
    expect(where.dueDate.gte).toEqual(new Date(UTC_TODAY - REMINDER_LOOKBACK_DAYS * DAY));
    expect(where.dueDate.lte).toEqual(new Date(UTC_TODAY + REMINDER_NOTICE_DAYS * DAY));
    expect(orderBy).toEqual({ dueDate: "asc" });
    expect(take).toBe(REMINDER_BATCH);
  });

  it("returns zero and sends nothing when no request is due a reminder", async () => {
    db.subcontractorCarbonSubmission.findMany.mockResolvedValue([]);

    expect(await processSubcontractorReminders(NOW)).toBe(0);
    expect(mail.sendEmail).not.toHaveBeenCalled();
  });
});

describe("processSubcontractorReminders: sending", () => {
  it("emails a fresh link, then stores only its hash, so the earlier link stops working", async () => {
    expect(await processSubcontractorReminders(NOW)).toBe(1);

    const emailed = mail.subcontractorReminderEmail.mock.calls[0][0];
    const token = emailed.portalUrl.split("/").pop();
    expect(mail.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "sam@groundworks.test" }));
    expect(emailed).toMatchObject({ recipientName: "Groundworks Ltd", orgName: "Org A", daysLeft: 5 });

    const stored = db.subcontractorCarbonSubmission.update.mock.calls[0][0];
    expect(stored.where).toEqual({ id: "sub-1" });
    expect(stored.data.tokenHash).toBe(hashToken(token));
    expect(stored.data.linkSentAt).toEqual(NOW);
    // The raw token never reaches the database.
    expect(JSON.stringify(db.subcontractorCarbonSubmission.update.mock.calls)).not.toContain(token);
  });

  it("stores the new hash only after the email has gone out", async () => {
    await processSubcontractorReminders(NOW);

    const sent = mail.sendEmail.mock.invocationCallOrder[0];
    const stored = db.subcontractorCarbonSubmission.update.mock.invocationCallOrder[0];
    expect(sent).toBeLessThan(stored);
  });

  it("claims the reminder before sending, so a second run cannot send it again", async () => {
    await processSubcontractorReminders(NOW);

    const claim = db.subcontractorCarbonSubmission.updateMany.mock.calls[0][0];
    expect(claim.where).toEqual({
      id: "sub-1",
      status: "requested",
      reminderCount: 0,
      lastReminderAt: null,
      linkSentAt: new Date("2026-11-01T10:00:00Z"),
    });
    expect(claim.data).toEqual({ reminderCount: { increment: 1 }, lastReminderAt: NOW });
    expect(db.subcontractorCarbonSubmission.updateMany.mock.invocationCallOrder[0])
      .toBeLessThan(mail.sendEmail.mock.invocationCallOrder[0]);
  });

  it("sends nothing when the row changed after it was read, for example another run claimed it", async () => {
    db.subcontractorCarbonSubmission.updateMany.mockResolvedValue({ count: 0 });

    expect(await processSubcontractorReminders(NOW)).toBe(0);
    expect(mail.sendEmail).not.toHaveBeenCalled();
    expect(db.subcontractorCarbonSubmission.update).not.toHaveBeenCalled();
    expect(audit.writeAuditLog).not.toHaveBeenCalled();
  });

  it("gives the claim back and stores no new link when the email fails, so tomorrow's run tries again", async () => {
    mail.sendEmail.mockRejectedValueOnce(new Error("mail provider down"));

    expect(await processSubcontractorReminders(NOW)).toBe(0);

    const undo = db.subcontractorCarbonSubmission.updateMany.mock.calls[1][0];
    expect(undo.where).toEqual({ id: "sub-1", reminderCount: 1 });
    expect(undo.data).toEqual({ reminderCount: 0, lastReminderAt: null });
    expect(db.subcontractorCarbonSubmission.update).not.toHaveBeenCalled();
    expect(audit.writeAuditLog).not.toHaveBeenCalled();
  });

  it("carries on with the next request when one fails, and counts only the ones sent", async () => {
    db.subcontractorCarbonSubmission.findMany.mockResolvedValue([row({ id: "sub-1" }), row({ id: "sub-2" })]);
    db.subcontractorCarbonSubmission.updateMany.mockRejectedValueOnce(new Error("connection reset"));

    expect(await processSubcontractorReminders(NOW)).toBe(1);
    expect(mail.sendEmail).toHaveBeenCalledTimes(1);
    expect(db.subcontractorCarbonSubmission.update.mock.calls[0][0].where).toEqual({ id: "sub-2" });
  });

  it("writes an audit entry for each reminder sent, with the count and the days left", async () => {
    await processSubcontractorReminders(NOW);

    expect(audit.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: "org-a",
      action: "subcontractor_submission.reminder_sent",
      resourceId: "sub-1",
      metadata: expect.objectContaining({ reminderCount: 1, daysLeft: 5 }),
    }));
  });
});
