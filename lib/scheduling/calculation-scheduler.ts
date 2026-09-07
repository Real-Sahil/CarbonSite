import { prisma } from "@/lib/db";
import { dispatchCalculation } from "@/lib/jobs/dispatch";
import { writeAuditLog } from "@/lib/db/audit";
import { createHash } from "crypto";

export type ScheduleFrequency = "manual" | "weekly" | "monthly" | "quarterly" | "annually";

// ── Helpers ──────────────────────────────────────────────────────────────────

export function calculateNextRun(
  frequency: ScheduleFrequency,
  dayOfWeek?: number | null,
  dayOfMonth?: number | null,
  quarterMonth?: number | null,
): Date | null {
  if (frequency === "manual") return null;

  const now = new Date();

  if (frequency === "weekly") {
    const target = dayOfWeek ?? 1;
    const daysUntil = (target - now.getDay() + 7) % 7 || 7;
    const next = new Date(now);
    next.setDate(next.getDate() + daysUntil);
    next.setHours(2, 0, 0, 0);
    return next;
  }

  if (frequency === "monthly") {
    const target = dayOfMonth ?? 1;
    const next = new Date(now.getFullYear(), now.getMonth() + 1, target, 2, 0, 0, 0);
    return next;
  }

  if (frequency === "quarterly") {
    const tMonth = (quarterMonth ?? 1) - 1;
    let qStart = Math.floor(now.getMonth() / 3) * 3;
    let year = now.getFullYear();
    // Advance to the next quarter that hasn't started yet
    while (new Date(year, qStart + tMonth, 1, 2, 0, 0, 0) <= now) {
      qStart += 3;
      if (qStart >= 12) { qStart = 0; year++; }
    }
    return new Date(year, qStart + tMonth, 1, 2, 0, 0, 0);
  }

  if (frequency === "annually") {
    return new Date(now.getFullYear() + 1, 0, 1, 2, 0, 0, 0);
  }

  return null;
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function createCalculationSchedule(
  organizationId: string,
  params: {
    name: string;
    description?: string;
    reportingPeriodId: string;
    frequency: ScheduleFrequency;
    dayOfWeek?: number;
    dayOfMonth?: number;
    quarterMonth?: number;
  },
  userId: string,
) {
  const period = await prisma.reportingPeriod.findUnique({
    where: { id: params.reportingPeriodId },
    select: { id: true, organizationId: true },
  });
  if (!period || period.organizationId !== organizationId) {
    throw new Error("Reporting period not found");
  }

  const nextRunAt = calculateNextRun(
    params.frequency,
    params.dayOfWeek,
    params.dayOfMonth,
    params.quarterMonth,
  );

  const schedule = await prisma.calculationSchedule.create({
    data: {
      organizationId,
      reportingPeriodId: params.reportingPeriodId,
      name: params.name,
      description: params.description,
      frequency: params.frequency,
      dayOfWeek: params.dayOfWeek,
      dayOfMonth: params.dayOfMonth,
      quarterMonth: params.quarterMonth,
      nextRunAt,
      enabled: true,
    },
  });

  await writeAuditLog({
    organizationId,
    actorUserId: userId,
    action: "calculation.schedule_created",
    resourceType: "calculation_schedule",
    resourceId: schedule.id,
    metadata: { name: params.name, frequency: params.frequency },
  });

  return schedule;
}

export async function getCalculationSchedules(organizationId: string) {
  return prisma.calculationSchedule.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getScheduleStats(organizationId: string) {
  const schedules = await prisma.calculationSchedule.findMany({
    where: { organizationId },
    select: { enabled: true, nextRunAt: true },
  });
  const enabled = schedules.filter((s) => s.enabled);
  const nextRunAts = enabled.map((s) => s.nextRunAt).filter(Boolean) as Date[];
  return {
    total: schedules.length,
    enabled: enabled.length,
    disabled: schedules.length - enabled.length,
    nextScheduledRun: nextRunAts.length
      ? new Date(Math.min(...nextRunAts.map((d) => d.getTime())))
      : null,
  };
}

// ── Trigger a single schedule immediately ────────────────────────────────────
// Finds the latest methodology version + factor library for the org and
// creates a real CalculationRun, then dispatches it inline/queued.

export async function triggerSchedule(
  scheduleId: string,
  organizationId: string,
  userId?: string,
): Promise<{ calculationRunId: string }> {
  const schedule = await prisma.calculationSchedule.findUnique({
    where: { id: scheduleId },
    select: { id: true, organizationId: true, reportingPeriodId: true },
  });
  if (!schedule || schedule.organizationId !== organizationId) {
    throw new Error("Schedule not found");
  }

  const [methodology, factorLibrary] = await Promise.all([
    prisma.methodologyVersion.findFirst({ orderBy: { createdAt: "desc" }, select: { id: true } }),
    prisma.factorLibrary.findFirst({ orderBy: { createdAt: "desc" }, select: { id: true } }),
  ]);
  if (!methodology) throw new Error("No methodology version found — run the database seed.");
  if (!factorLibrary) throw new Error("No factor library found — run the database seed.");

  // Idempotency: dedupe same schedule within the same minute.
  const minuteBucket = Math.floor(Date.now() / 60_000);
  const triggerHash = createHash("sha256")
    .update(`schedule:${scheduleId}:${minuteBucket}`)
    .digest("hex");

  const inFlight = await prisma.calculationRun.findFirst({
    where: {
      organizationId,
      reportingPeriodId: schedule.reportingPeriodId,
      status: { in: ["queued", "running"] },
    },
    select: { id: true },
  });
  if (inFlight) return { calculationRunId: inFlight.id };

  let run;
  try {
    run = await prisma.calculationRun.create({
      data: {
        organizationId,
        reportingPeriodId: schedule.reportingPeriodId,
        methodologyVersionId: methodology.id,
        factorLibraryId: factorLibrary.id,
        triggeredByUserId: userId ?? undefined,
        triggerHash,
        status: "queued",
      },
    });
  } catch {
    const existing = await prisma.calculationRun.findUnique({
      where: { triggerHash },
      select: { id: true },
    });
    if (existing) return { calculationRunId: existing.id };
    throw new Error("Failed to create calculation run");
  }

  await prisma.calculationSchedule.update({
    where: { id: scheduleId },
    data: { lastRunAt: new Date() },
  });

  await dispatchCalculation({ calculationRunId: run.id, orgId: organizationId }).catch(
    async (err) => {
      console.error(`[scheduler] run ${run.id} failed:`, err);
      await prisma.calculationRun
        .update({
          where: { id: run.id, status: "queued" },
          data: {
            status: "failed",
            finishedAt: new Date(),
            errorMessage: err instanceof Error ? err.message.slice(0, 500) : "Dispatch failed.",
          },
        })
        .catch(() => {});
    },
  );

  if (userId) {
    await writeAuditLog({
      organizationId,
      actorUserId: userId,
      action: "calculation.schedule_triggered",
      resourceType: "calculation_run",
      resourceId: run.id,
      metadata: { scheduleId },
    });
  }

  return { calculationRunId: run.id };
}

// ── Process all due schedules (called by cron) ────────────────────────────────

export async function processDueSchedules(): Promise<{ processed: number; errors: number }> {
  const now = new Date();
  const due = await prisma.calculationSchedule.findMany({
    where: {
      enabled: true,
      frequency: { not: "manual" },
      nextRunAt: { lte: now },
    },
    select: { id: true, organizationId: true, frequency: true, dayOfWeek: true, dayOfMonth: true, quarterMonth: true },
  });

  let processed = 0;
  let errors = 0;

  for (const s of due) {
    try {
      await triggerSchedule(s.id, s.organizationId);

      // Advance nextRunAt to the next occurrence.
      const next = calculateNextRun(
        s.frequency as ScheduleFrequency,
        s.dayOfWeek,
        s.dayOfMonth,
        s.quarterMonth,
      );
      await prisma.calculationSchedule.update({
        where: { id: s.id },
        data: { nextRunAt: next },
      });

      processed++;
    } catch (err) {
      console.error(`[scheduler] failed to trigger schedule ${s.id}:`, err);
      errors++;
    }
  }

  return { processed, errors };
}
