// Scheduled submission SLA monitoring job.
// Runs daily to check for FieldSubmissions pending review for more than 48 hours.
// Fires a notification to all org reviewers/admins the first time the SLA is breached.

import { prisma } from "@/lib/db";
import { dispatchNotification } from "@/lib/jobs/dispatch";
import { getLogger } from "@/lib/observability";

const logger = getLogger("submission-sla-monitoring");
const SLA_HOURS = 48;

export async function processSubmissionSlaMonitoring(): Promise<void> {
  try {
    const slaCutoff = new Date(Date.now() - SLA_HOURS * 3_600_000);

    const overdueSubmissions = await prisma.fieldSubmission.findMany({
      where: {
        status: { in: ["submitted", "under_review"] },
        submittedAt: { lt: slaCutoff },
        slaNotifiedAt: null,
      },
      select: {
        id: true,
        organizationId: true,
        documentType: true,
      },
      take: 500,
    });

    if (overdueSubmissions.length === 0) {
      logger.info("No overdue submissions");
      return;
    }

    logger.info("Found overdue submissions", { count: overdueSubmissions.length });

    // Group by org to batch the recipient lookups
    const byOrg = new Map<string, typeof overdueSubmissions>();
    for (const sub of overdueSubmissions) {
      const arr = byOrg.get(sub.organizationId) ?? [];
      arr.push(sub);
      byOrg.set(sub.organizationId, arr);
    }

    for (const [orgId, subs] of byOrg) {
      const reviewers = await prisma.organizationMembership.findMany({
        where: {
          organizationId: orgId,
          role: { in: ["admin", "reviewer"] },
          terminatedAt: null,
        },
        select: { userId: true },
      });

      if (reviewers.length === 0) continue;

      for (const reviewer of reviewers) {
        await dispatchNotification({
          type: "submission_sla_overdue",
          recipientUserId: reviewer.userId,
          orgId,
          resourceId: orgId,
          metadata: { overdueCount: subs.length },
        }).catch((err) =>
          logger.error("Failed to dispatch sla notification", {
            userId: reviewer.userId,
            orgId,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }

      // Mark all overdue submissions so we don't re-notify tomorrow
      await prisma.fieldSubmission.updateMany({
        where: { id: { in: subs.map((s) => s.id) } },
        data: { slaNotifiedAt: new Date() },
      });

      logger.info("Marked submissions notified", { orgId, count: subs.length });
    }
  } catch (error) {
    logger.error("Error in submission SLA monitoring", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
