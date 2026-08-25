// Scheduled DSAR SLA monitoring job.
// Runs daily to check for DsarRequests approaching the 30-day Art. 15 deadline.
// Alerts org admins before the SLA is breached (5 days before due date).

import { prisma } from "@/lib/db";

const ALERT_WINDOW_DAYS = 5; // Alert 5 days before due date

export async function processDsarSlaMonitoring(): Promise<void> {
  try {
    // Find all pending DSAR requests approaching their due date
    const now = new Date();
    const alertThreshold = new Date(
      now.getTime() + ALERT_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );

    const atRiskRequests = await prisma.dsarRequest.findMany({
      where: {
        status: "pending",
        dueBy: {
          lte: alertThreshold,
          gte: now, // Not already past due
        },
      },
      include: {
        user: { select: { id: true, email: true } },
        organization: { select: { id: true, name: true } },
        requestedByUser: { select: { id: true, email: true } },
      },
    });

    if (atRiskRequests.length === 0) {
      console.log("[dsar-sla-monitoring] All DSAR requests on schedule");
      return;
    }

    console.log(
      `[dsar-sla-monitoring] Found ${atRiskRequests.length} DSAR request(s) at risk`,
    );

    // For each at-risk request, notify the org admins
    for (const request of atRiskRequests) {
      if (!request.organizationId) continue; // Platform-level DSAR, skip for now

      const daysRemaining = Math.floor(
        (request.dueBy.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
      );

      console.log(
        `[dsar-sla-monitoring] DSAR ${request.id} due in ${daysRemaining} days (org: ${request.organization?.name})`,
      );

      // Log audit entry for tracking
      const { writeAuditLog } = await import("@/lib/db/audit");
      await writeAuditLog({
        organizationId: request.organizationId,
        action: "dsar.sla_approaching",
        resourceType: "DsarRequest",
        resourceId: request.id,
        metadata: {
          daysRemaining,
          dueDate: request.dueBy.toISOString(),
          subjectUserId: request.userId,
        },
      }).catch(() => null);

      // TODO: In production, enqueue notification jobs for each admin:
      // for (const admin of admins) {
      //   await enqueueNotification({
      //     type: "dsar_sla_alert",
      //     recipientUserId: admin.user.id,
      //     orgId: request.organizationId,
      //     resourceId: request.id,
      //     metadata: {
      //       daysRemaining,
      //       subjectEmail: request.user.email,
      //     },
      //   });
      // }
    }

    // Check for overdue requests (past due date)
    const overdueRequests = await prisma.dsarRequest.findMany({
      where: {
        status: "pending",
        dueBy: { lt: now },
      },
      include: { organization: { select: { id: true, name: true } } },
    });

    if (overdueRequests.length > 0) {
      console.error(
        `[dsar-sla-monitoring] CRITICAL: ${overdueRequests.length} DSAR request(s) overdue!`,
      );
      for (const request of overdueRequests) {
        console.error(
          `[dsar-sla-monitoring] Overdue DSAR ${request.id} (org: ${request.organization?.name}, due: ${request.dueBy.toISOString()})`,
        );
      }
      throw new Error(
        `${overdueRequests.length} DSAR request(s) overdue - SLA breach`,
      );
    }
  } catch (error) {
    console.error("[dsar-sla-monitoring] Error checking DSAR SLAs:", error);
    throw error; // Let pg-boss retry and Sentry capture
  }
}
