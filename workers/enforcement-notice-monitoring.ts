// Enforcement notice compliance deadline monitoring.
// Runs daily: alerts org admins when a notice compliance deadline has passed.

import { prisma } from "@/lib/db";
import { dispatchNotification } from "@/lib/jobs/dispatch";
import { writeAuditLog } from "@/lib/db/audit";
import { getLogger } from "@/lib/observability";

const logger = getLogger("enforcement-notice-monitoring");

export async function processEnforcementNoticeMonitoring(): Promise<void> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdueNotices = await prisma.enforcementNotice.findMany({
      where: {
        status: { in: ["open", "appealed"] },
        complianceDeadline: { lt: today },
        compliedAt: null,
      },
      select: {
        id: true,
        organizationId: true,
        reference: true,
        complianceDeadline: true,
        issuingBody: true,
      },
    });

    let alertCount = 0;
    for (const notice of overdueNotices) {
      const admins = await prisma.organizationMembership.findMany({
        where: {
          organizationId: notice.organizationId,
          role: { in: ["admin", "editor"] },
          terminatedAt: null,
        },
        select: { userId: true },
      });

      for (const admin of admins) {
        await dispatchNotification({
          type: "enforcement_notice_overdue",
          recipientUserId: admin.userId,
          orgId: notice.organizationId,
          resourceId: notice.id,
          metadata: {
            noticeRef: notice.reference,
            issuingBody: notice.issuingBody,
            complianceDeadline: notice.complianceDeadline?.toISOString(),
          },
        }).catch((err) =>
          logger.error("Failed to dispatch enforcement notice overdue notification", {
            noticeId: notice.id,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }

      await writeAuditLog({
        organizationId: notice.organizationId,
        action: "enforcement_notice.updated",
        resourceType: "EnforcementNotice",
        resourceId: notice.id,
        metadata: { reason: "overdue_alert_sent", reference: notice.reference },
      }).catch(() => null);

      alertCount++;
    }

    logger.info("Enforcement notice monitoring complete", { overdueAlerts: alertCount });
  } catch (error) {
    logger.error("Error in enforcement notice monitoring", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
