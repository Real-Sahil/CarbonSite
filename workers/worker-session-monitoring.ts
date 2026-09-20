// Welfare check monitoring for active worker sessions.
// Runs every 15 minutes: alerts org admins if a session has not pinged in >30 minutes.

import { prisma } from "@/lib/db";
import { dispatchNotification } from "@/lib/jobs/dispatch";
import { writeAuditLog } from "@/lib/db/audit";
import { getLogger } from "@/lib/observability";

const logger = getLogger("worker-session-monitoring");
const OVERDUE_THRESHOLD_MS = 30 * 60 * 1000;

export async function processWorkerSessionMonitoring(): Promise<void> {
  try {
    const now = new Date();
    const cutoff = new Date(now.getTime() - OVERDUE_THRESHOLD_MS);

    const overdueSessions = await prisma.workerSession.findMany({
      where: {
        endedAt: null,
        overdueAlert: false,
        OR: [
          { lastPingAt: { lte: cutoff } },
          { lastPingAt: null, startedAt: { lte: cutoff } },
        ],
      },
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    let alertCount = 0;
    for (const session of overdueSessions) {
      const lastCheck = session.lastPingAt ?? session.startedAt;
      const minutesSinceLastPing = Math.floor((now.getTime() - lastCheck.getTime()) / 60_000);
      const workerName = session.user.name ?? session.user.email;

      const admins = await prisma.organizationMembership.findMany({
        where: {
          organizationId: session.organizationId,
          role: { in: ["admin", "editor"] },
          terminatedAt: null,
        },
        select: { userId: true },
      });

      for (const admin of admins) {
        await dispatchNotification({
          type: "worker_session_overdue",
          recipientUserId: admin.userId,
          orgId: session.organizationId,
          resourceId: session.id,
          metadata: { workerName, minutesSinceLastPing },
        }).catch((err) =>
          logger.error("Failed to dispatch worker session overdue notification", {
            sessionId: session.id,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }

      await prisma.workerSession.update({
        where: { id: session.id },
        data: { overdueAlert: true, overdueAlertAt: now },
      });

      await writeAuditLog({
        organizationId: session.organizationId,
        action: "worker_session.overdue_alert",
        resourceType: "WorkerSession",
        resourceId: session.id,
        metadata: { minutesSinceLastPing, workerName },
      }).catch(() => null);

      alertCount++;
    }

    logger.info("Worker session monitoring complete", { overdueAlerts: alertCount });
  } catch (error) {
    logger.error("Error in worker session monitoring", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
