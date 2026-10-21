// Scheduled permit expiry monitoring job.
// Runs daily to check for:
//   - EnvironmentalPermits expiring within their renewalNoticeDays window
//   - PermitConditions whose nextDueOn is within 30/7/1 days
// Fires push+in-app notifications to org admins.

import { prisma } from "@/lib/db";
import { dispatchNotification } from "@/lib/jobs/dispatch";
import { writeAuditLog } from "@/lib/db/audit";
import { getLogger } from "@/lib/observability";

const logger = getLogger("permit-expiry-monitoring");

type Notify = Parameters<typeof dispatchNotification>[0];

// Sends to each org admin/editor; false when there were recipients and every send failed.
async function notifyAdmins(
  orgId: string,
  build: (userId: string) => Notify,
): Promise<boolean> {
  const admins = await prisma.organizationMembership.findMany({
    where: { organizationId: orgId, role: { in: ["admin", "editor"] }, terminatedAt: null },
    select: { userId: true },
  });
  let delivered = 0;
  for (const admin of admins) {
    try {
      await dispatchNotification(build(admin.userId));
      delivered++;
    } catch (err) {
      logger.error("Failed to dispatch permit notification", {
        userId: admin.userId,
        orgId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return admins.length === 0 || delivered > 0;
}

export async function processPermitExpiryMonitoring(): Promise<void> {
  try {
    const now = new Date();

    // ── Permit expiry ─────────────────────────────────────────────────────────
    // Find permits whose expiresOn falls within their individual renewalNoticeDays window
    // and haven't had an alert sent yet.
    const permits = await prisma.environmentalPermit.findMany({
      where: {
        expiresOn: { not: null },
        expiryAlertSentAt: null,
      },
      select: {
        id: true,
        organizationId: true,
        reference: true,
        expiresOn: true,
        renewalNoticeDays: true,
      },
      orderBy: { expiresOn: "asc" },
      take: 5000,
    });

    let permitAlertsCount = 0;
    for (const permit of permits) {
      if (!permit.expiresOn) continue;

      const msUntilExpiry = permit.expiresOn.getTime() - now.getTime();
      const daysUntilExpiry = Math.floor(msUntilExpiry / 86_400_000);
      const noticeDays = permit.renewalNoticeDays ?? 90;

      if (daysUntilExpiry > noticeDays || daysUntilExpiry < 0) continue;

      try {
        const sent = await notifyAdmins(permit.organizationId, (userId) => ({
          type: "permit_expiry_warning",
          recipientUserId: userId,
          orgId: permit.organizationId,
          resourceId: permit.id,
          metadata: { permitRef: permit.reference ?? permit.id, daysUntilExpiry },
        }));
        if (!sent) continue;

        await prisma.environmentalPermit.updateMany({
          where: { id: permit.id, organizationId: permit.organizationId },
          data: { expiryAlertSentAt: now },
        });

        await writeAuditLog({
          organizationId: permit.organizationId,
          action: "permit.expiry_alert_sent",
          resourceType: "EnvironmentalPermit",
          resourceId: permit.id,
          metadata: { daysUntilExpiry },
        }).catch(() => null);
      } catch (err) {
        logger.error("Permit expiry alert failed", {
          permitId: permit.id,
          error: err instanceof Error ? err.message : String(err),
        });
        continue;
      }

      permitAlertsCount++;
    }

    // ── Condition due dates ───────────────────────────────────────────────────
    const conditionThresholds = [30, 7, 1];
    const maxThreshold = Math.max(...conditionThresholds);
    const windowEnd = new Date(now.getTime() + maxThreshold * 86_400_000);

    const conditions = await prisma.permitCondition.findMany({
      where: {
        nextDueOn: { gte: now, lte: windowEnd },
        conditionAlertSentAt: null,
      },
      include: {
        permit: { select: { reference: true } },
      },
      orderBy: { nextDueOn: "asc" },
      take: 5000,
    });

    let conditionAlertsCount = 0;
    for (const condition of conditions) {
      if (!condition.nextDueOn) continue;

      const daysUntilDue = Math.floor(
        (condition.nextDueOn.getTime() - now.getTime()) / 86_400_000,
      );

      if (!conditionThresholds.some((t) => daysUntilDue <= t)) continue;

      try {
        const conditionRef =
          condition.permit?.reference
            ? `${condition.permit.reference} - ${condition.description.slice(0, 60)}`
            : condition.description.slice(0, 80);

        const sent = await notifyAdmins(condition.organizationId, (userId) => ({
          type: "permit_condition_due",
          recipientUserId: userId,
          orgId: condition.organizationId,
          resourceId: condition.id,
          metadata: { conditionRef, daysUntilDue },
        }));
        if (!sent) continue;

        await prisma.permitCondition.updateMany({
          where: { id: condition.id, organizationId: condition.organizationId },
          data: { conditionAlertSentAt: now },
        });

        await writeAuditLog({
          organizationId: condition.organizationId,
          action: "permit.condition_due_alert_sent",
          resourceType: "PermitCondition",
          resourceId: condition.id,
          metadata: { daysUntilDue },
        }).catch(() => null);
      } catch (err) {
        logger.error("Permit condition alert failed", {
          conditionId: condition.id,
          error: err instanceof Error ? err.message : String(err),
        });
        continue;
      }

      conditionAlertsCount++;
    }

    logger.info("Permit expiry monitoring complete", {
      permitAlerts: permitAlertsCount,
      conditionAlerts: conditionAlertsCount,
    });
  } catch (error) {
    logger.error("Error in permit expiry monitoring", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
