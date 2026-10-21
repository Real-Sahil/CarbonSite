// Enforcement notice compliance deadline monitoring.
// Runs daily: alerts org admins once when a notice compliance deadline has passed.

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
        overdueAlertedAt: null,
      },
      select: {
        id: true,
        organizationId: true,
        reference: true,
        complianceDeadline: true,
        issuingBody: true,
      },
      orderBy: { complianceDeadline: "asc" },
      take: 500,
    });

    let alertCount = 0;
    for (const notice of overdueNotices) {
      try {
        const admins = await prisma.organizationMembership.findMany({
          where: {
            organizationId: notice.organizationId,
            role: { in: ["admin", "editor"] },
            terminatedAt: null,
          },
          select: { userId: true },
        });

        let delivered = 0;
        for (const admin of admins) {
          try {
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
            });
            delivered++;
          } catch (err) {
            logger.error("Failed to dispatch enforcement notice overdue notification", {
              noticeId: notice.id,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        // Nobody reached: leave it unmarked so tomorrow's run tries again.
        if (admins.length > 0 && delivered === 0) continue;

        await prisma.enforcementNotice.updateMany({
          where: { id: notice.id, organizationId: notice.organizationId },
          data: { overdueAlertedAt: new Date() },
        });

        await writeAuditLog({
          organizationId: notice.organizationId,
          action: "enforcement_notice.updated",
          resourceType: "EnforcementNotice",
          resourceId: notice.id,
          metadata: { reason: "overdue_alert_sent", reference: notice.reference },
        }).catch(() => null);

        alertCount++;
      } catch (err) {
        logger.error("Enforcement notice alert failed", {
          noticeId: notice.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info("Enforcement notice monitoring complete", { overdueAlerts: alertCount });
  } catch (error) {
    logger.error("Error in enforcement notice monitoring", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
