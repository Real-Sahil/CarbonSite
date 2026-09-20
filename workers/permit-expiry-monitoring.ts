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
    });

    let permitAlertsCount = 0;
    for (const permit of permits) {
      if (!permit.expiresOn) continue;

      const msUntilExpiry = permit.expiresOn.getTime() - now.getTime();
      const daysUntilExpiry = Math.floor(msUntilExpiry / 86_400_000);
      const noticeDays = permit.renewalNoticeDays ?? 90;

      if (daysUntilExpiry > noticeDays || daysUntilExpiry < 0) continue;

      const admins = await prisma.organizationMembership.findMany({
        where: {
          organizationId: permit.organizationId,
          role: { in: ["admin", "editor"] },
          terminatedAt: null,
        },
        select: { userId: true },
      });

      for (const admin of admins) {
        await dispatchNotification({
          type: "permit_expiry_warning",
          recipientUserId: admin.userId,
          orgId: permit.organizationId,
          resourceId: permit.id,
          metadata: {
            permitRef: permit.reference ?? permit.id,
            daysUntilExpiry,
          },
        }).catch((err) =>
          logger.error("Failed to dispatch permit expiry notification", {
            userId: admin.userId,
            permitId: permit.id,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }

      await prisma.environmentalPermit.update({
        where: { id: permit.id },
        data: { expiryAlertSentAt: now },
      });

      await writeAuditLog({
        organizationId: permit.organizationId,
        action: "permit.expiry_alert_sent",
        resourceType: "EnvironmentalPermit",
        resourceId: permit.id,
        metadata: { daysUntilExpiry },
      }).catch(() => null);

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
    });

    let conditionAlertsCount = 0;
    for (const condition of conditions) {
      if (!condition.nextDueOn) continue;

      const daysUntilDue = Math.floor(
        (condition.nextDueOn.getTime() - now.getTime()) / 86_400_000,
      );

      if (!conditionThresholds.some((t) => daysUntilDue <= t)) continue;

      const admins = await prisma.organizationMembership.findMany({
        where: {
          organizationId: condition.organizationId,
          role: { in: ["admin", "editor"] },
          terminatedAt: null,
        },
        select: { userId: true },
      });

      const conditionRef =
        condition.permit?.reference
          ? `${condition.permit.reference} - ${condition.description.slice(0, 60)}`
          : condition.description.slice(0, 80);

      for (const admin of admins) {
        await dispatchNotification({
          type: "permit_condition_due",
          recipientUserId: admin.userId,
          orgId: condition.organizationId,
          resourceId: condition.id,
          metadata: { conditionRef, daysUntilDue },
        }).catch((err) =>
          logger.error("Failed to dispatch condition due notification", {
            userId: admin.userId,
            conditionId: condition.id,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }

      await prisma.permitCondition.update({
        where: { id: condition.id },
        data: { conditionAlertSentAt: now },
      });

      await writeAuditLog({
        organizationId: condition.organizationId,
        action: "permit.condition_due_alert_sent",
        resourceType: "PermitCondition",
        resourceId: condition.id,
        metadata: { daysUntilDue },
      }).catch(() => null);

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
