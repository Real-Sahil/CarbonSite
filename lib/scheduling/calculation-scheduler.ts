import { prisma } from "@/lib/db";
import { enqueueCalculation } from "@/lib/jobs/queues";
import { writeAuditLog } from "@/lib/db/audit";

export interface CalculationSchedule {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  reportingPeriodId: string;
  enabled: boolean;
  schedule: "manual" | "weekly" | "monthly" | "quarterly" | "annually";
  dayOfWeek?: number; // 0-6 for weekly (0=Sunday)
  dayOfMonth?: number; // 1-31 for monthly
  quarterMonth?: number; // 1, 4, 7, 10 for quarterly
  createdAt: Date;
  updatedAt: Date;
  lastRun?: Date;
  nextRun?: Date;
}

/**
 * Create a new calculation schedule for an organization.
 */
export async function createCalculationSchedule(
  organizationId: string,
  params: {
    name: string;
    description?: string;
    reportingPeriodId: string;
    schedule: CalculationSchedule["schedule"];
    dayOfWeek?: number;
    dayOfMonth?: number;
    quarterMonth?: number;
  },
  userId: string
): Promise<CalculationSchedule> {
  // Validate reporting period exists
  const period = await prisma.reportingPeriod.findUnique({
    where: { id: params.reportingPeriodId },
  });

  if (!period || period.organizationId !== organizationId) {
    throw new Error("Reporting period not found");
  }

  // In a real implementation, store in database
  // For now, return the schedule object
  const schedule: CalculationSchedule = {
    id: `sched_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    organizationId,
    name: params.name,
    description: params.description,
    reportingPeriodId: params.reportingPeriodId,
    enabled: true,
    schedule: params.schedule,
    dayOfWeek: params.dayOfWeek,
    dayOfMonth: params.dayOfMonth,
    quarterMonth: params.quarterMonth,
    createdAt: new Date(),
    updatedAt: new Date(),
    nextRun: calculateNextRun(params.schedule, params.dayOfWeek, params.dayOfMonth, params.quarterMonth),
  };

  // Write audit log
  await writeAuditLog({
    organizationId,
    action: "calculation.schedule_created",
    actorUserId: userId,
    resourceId: schedule.id,
    resourceType: "calculation_schedule",
    metadata: {
      scheduleName: params.name,
      scheduleType: params.schedule,
    },
  });

  console.log(
    `[Scheduler] Created schedule ${schedule.id} for org ${organizationId}`
  );
  return schedule;
}

/**
 * Trigger a calculation run immediately or at a scheduled time.
 */
export async function triggerCalculation(
  organizationId: string,
  reportingPeriodId: string,
  source: "manual" | "scheduled" | "webhook" = "manual",
  userId?: string
): Promise<{ jobId: string; scheduleTime?: Date }> {
  // Validate org and period exist
  const [org, period] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId } }),
    prisma.reportingPeriod.findUnique({ where: { id: reportingPeriodId } }),
  ]);

  if (!org) {
    throw new Error("Organization not found");
  }

  if (!period || period.organizationId !== organizationId) {
    throw new Error("Reporting period not found");
  }

  // Note: This function is incomplete for MVP. In a full implementation:
  // 1. Create CalculationRun with status "queued"
  // 2. Call enqueueCalculation with calculationRunId and orgId
  // 3. Write audit log with the new run ID
  // For now, use a placeholder job ID and skip enqueue
  const jobId = `calc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  console.log(
    `[Scheduler] Triggered calculation for org ${organizationId}, period ${reportingPeriodId}`
  );

  if (userId) {
    await writeAuditLog({
      organizationId,
      action: "calculation.triggered",
      actorUserId: userId,
      resourceId: reportingPeriodId,
      resourceType: "reporting_period",
      metadata: {
        source,
      },
    });
  }

  return { jobId };
}

/**
 * Get all scheduled calculations for an organization.
 */
export async function getCalculationSchedules(
  organizationId: string
): Promise<CalculationSchedule[]> {
  // In a real implementation, fetch from database
  // For MVP, return empty array
  return [];
}

/**
 * Update a calculation schedule.
 */
export async function updateCalculationSchedule(
  organizationId: string,
  scheduleId: string,
  updates: Partial<CalculationSchedule>,
  userId: string
): Promise<CalculationSchedule> {
  // In real implementation, update database
  const schedule = {
    ...updates,
    id: scheduleId,
    organizationId,
    updatedAt: new Date(),
  } as CalculationSchedule;

  await writeAuditLog({
    organizationId,
    action: "calculation.schedule_updated",
    actorUserId: userId,
    resourceId: scheduleId,
    resourceType: "calculation_schedule",
    metadata: updates,
  });

  return schedule;
}

/**
 * Disable a calculation schedule.
 */
export async function disableCalculationSchedule(
  organizationId: string,
  scheduleId: string,
  userId: string
): Promise<void> {
  await writeAuditLog({
    organizationId,
    action: "calculation.schedule_disabled",
    actorUserId: userId,
    resourceId: scheduleId,
    resourceType: "calculation_schedule",
  });

  console.log(`[Scheduler] Disabled schedule ${scheduleId}`);
}

/**
 * Calculate next run time based on schedule frequency.
 */
export function calculateNextRun(
  schedule: CalculationSchedule["schedule"],
  dayOfWeek?: number,
  dayOfMonth?: number,
  quarterMonth?: number
): Date {
  const now = new Date();

  switch (schedule) {
    case "weekly": {
      const targetDay = dayOfWeek ?? 1; // Default to Monday
      const daysUntilTarget = (targetDay - now.getDay() + 7) % 7 || 7;
      const nextRun = new Date(now);
      nextRun.setDate(nextRun.getDate() + daysUntilTarget);
      nextRun.setHours(2, 0, 0, 0); // Run at 2 AM
      return nextRun;
    }

    case "monthly": {
      const targetDay = dayOfMonth ?? 1;
      const nextRun = new Date(now.getFullYear(), now.getMonth() + 1, targetDay);
      nextRun.setHours(2, 0, 0, 0);
      return nextRun;
    }

    case "quarterly": {
      const targetMonth = quarterMonth ?? 1;
      let nextQuarter = Math.floor(now.getMonth() / 3) + 1;
      let nextYear = now.getFullYear();

      if (nextQuarter * 3 <= now.getMonth()) {
        nextQuarter++;
      }
      if (nextQuarter > 4) {
        nextQuarter = 1;
        nextYear++;
      }

      const nextRun = new Date(nextYear, (nextQuarter - 1) * 3 + targetMonth - 1, 1);
      nextRun.setHours(2, 0, 0, 0);
      return nextRun;
    }

    case "annually": {
      const nextRun = new Date(now.getFullYear() + 1, 0, 1);
      nextRun.setHours(2, 0, 0, 0);
      return nextRun;
    }

    default:
      return new Date(); // Manual, no scheduled run
  }
}

/**
 * Process all due calculation schedules (called by worker/cron).
 */
export async function processDueSchedules(): Promise<{
  processed: number;
  errors: number;
}> {
  console.log(`[Scheduler] Processing due calculation schedules`);

  // In real implementation, query database for schedules where nextRun <= now
  // For MVP, just log that we ran
  return { processed: 0, errors: 0 };
}

/**
 * Get calculation schedule stats for an organization.
 */
export async function getScheduleStats(organizationId: string) {
  // In real implementation, aggregate from database
  return {
    total: 0,
    enabled: 0,
    disabled: 0,
    nextScheduledRun: null as Date | null,
  };
}
