import { prisma } from "@/lib/db";
import { ROLE_GROUPS } from "@/lib/auth/session";
import { dispatchNotification } from "@/lib/jobs/dispatch";
import { getLogger } from "@/lib/observability";
import { defaultMonth, loadChecklist, monthLabel } from "./monthly";

// Once a month (migration 20261005000076, the 3rd at 07:15 UTC) tells each
// organisation's editors how many things are outstanding for the month just
// ended, with a link to the checklist. Organisations with nothing to do are not
// messaged. The notification row for (person, month) is the record that it was
// sent, so a repeated or late run sends nothing twice.

const logger = getLogger("completeness.reminders");

export async function processMonthlyChecklistReminders(now = new Date()): Promise<number> {
  const month = defaultMonth(now);
  const label = monthLabel(month);

  // Only organisations that already hold records; a brand-new account is not nagged.
  const orgs = await prisma.activityRecord.groupBy({ by: ["organizationId"], orderBy: { organizationId: "asc" }, take: 5000 });
  let sent = 0;

  for (const { organizationId: orgId } of orgs) {
    try {
      const actions = (await loadChecklist(orgId, month)).filter((i) => i.severity === "action");
      if (actions.length === 0) continue;

      const editors = await prisma.organizationMembership.findMany({
        where: { organizationId: orgId, role: { in: ROLE_GROUPS.editor }, terminatedAt: null },
        select: { userId: true },
      });
      for (const { userId } of editors) {
        const already = await prisma.notification.findFirst({
          where: { organizationId: orgId, userId, type: "monthly_checklist", resourceId: month },
          select: { id: true },
        });
        if (already) continue;
        await dispatchNotification({
          type: "monthly_checklist",
          recipientUserId: userId,
          orgId,
          resourceId: month,
          metadata: { count: actions.length, monthLabel: label, summary: actions.slice(0, 3).map((a) => a.title).join("; ") },
        });
        sent++;
      }
    } catch (err) {
      logger.error("Monthly checklist reminder failed for an organisation", { orgId, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return sent;
}
