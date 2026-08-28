// Scheduled DSAR SLA monitoring job.
// Runs daily to check for DsarRequests approaching the 30-day Art. 15 deadline.
// Alerts org admins before the SLA is breached (5 days before due date).

import { prisma } from "@/lib/db";
import { enqueueNotification } from "@/lib/jobs/queues/index";
import { dsarLogger } from "@/lib/logger";

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
      dsarLogger.info("All DSAR requests on schedule");
      return;
    }

    dsarLogger.info("Found DSAR requests at risk", {
      count: atRiskRequests.length,
    });

    // For each at-risk request, notify the org admins
    for (const request of atRiskRequests) {
      if (!request.organizationId) continue; // Platform-level DSAR, skip for now

      const daysRemaining = Math.floor(
        (request.dueBy.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
      );

      dsarLogger.info("DSAR SLA approaching", {
        requestId: request.id,
        orgName: request.organization?.name,
        daysRemaining,
      });

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

      // Enqueue notification jobs for each org admin
      const admins = await prisma.organizationMembership.findMany({
        where: {
          organizationId: request.organizationId,
          role: "admin",
          terminatedAt: null,
        },
        select: { userId: true },
      });

      for (const admin of admins) {
        await enqueueNotification({
          type: "dsar_sla_alert",
          recipientUserId: admin.userId,
          orgId: request.organizationId,
          resourceId: request.id,
          metadata: {
            daysRemaining,
            subjectEmail: request.user.email,
          },
        }).catch((err) =>
          dsarLogger.error("Failed to enqueue notification", {
            adminUserId: admin.userId,
            requestId: request.id,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }
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
      dsarLogger.error("DSAR requests overdue — SLA breach", {
        overdueCount: overdueRequests.length,
        requests: overdueRequests.map((r) => ({
          id: r.id,
          orgName: r.organization?.name,
          dueDate: r.dueBy.toISOString(),
        })),
      });
      throw new Error(
        `${overdueRequests.length} DSAR request(s) overdue - SLA breach`,
      );
    }
  } catch (error) {
    dsarLogger.error("Error checking DSAR SLAs", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error; // Let pg-boss retry and Sentry capture
  }
}
