// Daily carbon budget forecast check (pg_cron → monitors/carbon-budgets).
// For every active project with a carbon budget, recomputes the burn-down and
// notifies the organisation's editors and project managers when the status
// gets worse (on track → at risk → over). The level alerted is stored on the
// budget, so a repeated or late run sends nothing new; a budget that recovers
// is reset so a later slip alerts again.

import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { ROLE_GROUPS } from "@/lib/auth/session";
import { dispatchNotification } from "@/lib/jobs/dispatch";
import { getLogger } from "@/lib/observability";
import { escalates } from "./burndown";
import { loadProjectBurndown } from "./burndown-load";

const logger = getLogger("carbon-budget-alerts");
const RECIPIENT_ROLES = [...new Set([...ROLE_GROUPS.editor, ...ROLE_GROUPS.projectManagers])];

export async function processCarbonBudgetAlerts(asOf = new Date()): Promise<{ checked: number; alerted: number }> {
  const budgets = await prisma.carbonBudget.findMany({
    where: { project: { status: { in: ["active", "on_hold"] } } },
    select: {
      id: true,
      organizationId: true,
      projectId: true,
      forecastAlertLevel: true,
      project: { select: { name: true, contractId: true } },
    },
  });

  let alerted = 0;
  for (const b of budgets) {
    try {
      const burndown = await loadProjectBurndown(b.organizationId, b.projectId, asOf);
      if (!burndown) continue;
      const next = burndown.status === "over" || burndown.status === "at_risk" ? burndown.status : null;

      if (!next) {
        if (b.forecastAlertLevel) {
          await prisma.carbonBudget.update({ where: { id: b.id }, data: { forecastAlertLevel: null } });
        }
        continue;
      }
      if (!escalates(b.forecastAlertLevel, next)) continue;

      const members = await prisma.organizationMembership.findMany({
        where: { organizationId: b.organizationId, role: { in: RECIPIENT_ROLES }, terminatedAt: null },
        select: { userId: true },
      });
      for (const m of members) {
        await dispatchNotification({
          type: "carbon_budget_forecast",
          recipientUserId: m.userId,
          orgId: b.organizationId,
          resourceId: b.id,
          metadata: {
            status: next,
            projectName: b.project.name,
            projectId: b.projectId,
            contractId: b.project.contractId,
            reason: burndown.reasons[0] ?? null,
          },
        }).catch((err) =>
          logger.error("Failed to dispatch carbon budget alert", {
            budgetId: b.id,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }

      await prisma.carbonBudget.update({ where: { id: b.id }, data: { forecastAlertLevel: next, forecastAlertedAt: asOf } });
      await writeAuditLog({
        organizationId: b.organizationId,
        action: "carbon_budget.forecast_alert",
        resourceType: "CarbonBudget",
        resourceId: b.id,
        metadata: {
          status: next,
          previous: b.forecastAlertLevel,
          forecastAtCompletion: burndown.forecastAtCompletion,
          method: burndown.method,
          actualToDate: burndown.actualToDate,
          budgetTco2e: burndown.budgetTco2e,
          recipients: members.length,
        },
      }).catch(() => null);
      alerted++;
    } catch (err) {
      logger.error("Carbon budget check failed", { budgetId: b.id, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return { checked: budgets.length, alerted };
}
