import type { SubcontractorCarbonSubmission } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { sendEmail, subcontractorReminderEmail } from "@/lib/notifications/email";
import { getLogger } from "@/lib/observability";
import { daysUntilDue, reminderDateWindow, reminderGapCutoff, MAX_REMINDERS } from "./deadline";
import { issueLinkToken, portalUrl } from "./portal";

// Daily reminders for subcontractor requests whose figures are still owed. The
// monitor (`subcontractor-reminders`) calls this; see the monitors route.

const logger = getLogger("subcontractor.reminders");

/** Requests handled per run, earliest due date first. The rest wait for the next run. */
export const REMINDER_BATCH = 50;

type ReminderRow = SubcontractorCarbonSubmission & { organization: { name: string } };

/**
 * Sends one reminder to each request that is still owed, has a contact email and
 * a link already sent, and is due within the notice period or overdue by no more
 * than the lookback. Each reminder carries a fresh link, so the earlier one stops
 * working when it goes out. Returns how many were sent.
 */
export async function processSubcontractorReminders(now = new Date()): Promise<number> {
  const { from, to } = reminderDateWindow(now);
  const cutoff = reminderGapCutoff(now);
  const rows: ReminderRow[] = await prisma.subcontractorCarbonSubmission.findMany({
    where: {
      status: { in: ["requested", "overdue"] },
      contactEmail: { not: null },
      linkSentAt: { not: null },
      dueDate: { gte: from, lte: to },
      reminderCount: { lt: MAX_REMINDERS },
      // Same rule as reminderDue(): the gap runs from the last reminder, or from the link.
      OR: [
        { lastReminderAt: { lt: cutoff } },
        { lastReminderAt: null, linkSentAt: { lt: cutoff } },
      ],
    },
    orderBy: { dueDate: "asc" },
    take: REMINDER_BATCH,
    include: { organization: { select: { name: true } } },
  });

  let sent = 0;
  for (const row of rows) {
    try {
      if (await sendReminder(row, now)) sent++;
    } catch (err) {
      logger.error("Failed to process subcontractor reminder", {
        submissionId: row.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return sent;
}

async function sendReminder(row: ReminderRow, now: Date): Promise<boolean> {
  if (!row.contactEmail) return false;

  // Claim before sending: a second run, or a crash after the email goes, must
  // not send the same reminder twice. The where-clause fails if the row changed
  // since it was read (a status change, a manual resend or another run).
  const claimed = await prisma.subcontractorCarbonSubmission.updateMany({
    where: {
      id: row.id,
      status: row.status,
      reminderCount: row.reminderCount,
      lastReminderAt: row.lastReminderAt,
      linkSentAt: row.linkSentAt,
    },
    data: { reminderCount: { increment: 1 }, lastReminderAt: now },
  });
  if (claimed.count === 0) return false;

  const issued = issueLinkToken(now);
  const daysLeft = daysUntilDue(row.dueDate, now);
  try {
    await sendEmail({
      to: row.contactEmail,
      ...subcontractorReminderEmail({
        recipientName: row.subcontractorName,
        orgName: row.organization.name,
        reportingPeriodLabel: row.reportingPeriodLabel,
        dueDate: row.dueDate,
        daysLeft,
        portalUrl: portalUrl(issued.token),
        linkExpiresAt: issued.tokenExpiresAt,
      }),
    });
  } catch (err) {
    // Give the claim back, so tomorrow's run tries this request again. The new
    // hash was never stored, so the link already out still works.
    await prisma.subcontractorCarbonSubmission.updateMany({
      where: { id: row.id, reminderCount: row.reminderCount + 1 },
      data: { reminderCount: row.reminderCount, lastReminderAt: row.lastReminderAt },
    });
    logger.error("Subcontractor reminder email failed", {
      submissionId: row.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }

  // Store the new hash only after the email went out, so a stored hash always
  // belongs to a link someone was sent.
  await prisma.subcontractorCarbonSubmission.update({
    where: { id: row.id },
    data: { tokenHash: issued.tokenHash, tokenExpiresAt: issued.tokenExpiresAt, linkSentAt: now },
  });

  await writeAuditLog({
    organizationId: row.organizationId,
    action: "subcontractor_submission.reminder_sent",
    resourceType: "SubcontractorCarbonSubmission",
    resourceId: row.id,
    metadata: { reminderCount: row.reminderCount + 1, daysLeft, linkExpiresAt: issued.tokenExpiresAt.toISOString() },
  });
  return true;
}
