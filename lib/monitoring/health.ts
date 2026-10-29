// Watches the watchers. pg_cron calls each monitor route and nothing else notices if it stops (a Vault secret
// rotated, pg_net failing, the extension off), so every call leaves a heartbeat row and monitor-health, itself on
// pg_cron, reports a job that has not succeeded within its interval. It also reports a day on which too many
// dashboard loads were slow. Reports go through log.error, which reaches Sentry.

import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const log = createLogger("monitor-health");

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
// A run that is late by a day and a half is stale; weekly and monthly jobs get a few days of slack.
const DAILY = 36 * HOUR;
const WEEKLY = 8 * DAY;
const MONTHLY = 35 * DAY;

/** How long each scheduled monitor may go without a successful run. Keep in step with the cron migrations. */
export const EXPECTED_INTERVAL_MS: Record<string, number> = {
  "submission-sla": DAILY,
  "permit-expiry": DAILY,
  "enforcement-notices": DAILY,
  "account-policies": DAILY,
  "carbon-budgets": DAILY,
  tenders: DAILY,
  "management-systems": DAILY,
  "audit-anchor": DAILY,
  "subcontractor-reminders": DAILY,
  "waste-documents": WEEKLY,
  "audit-anonymise": MONTHLY,
  "monthly-checklist": MONTHLY,
};

/** monitor-health runs every six hours; this is how often it looks. */
export const HEALTH_CHECK_EVERY_MS = 6 * HOUR;

/** More than this share of loads at or over SLOW_LOAD_MS means the 95th percentile is over it. */
export const SLOW_LOAD_MS = 3_000;
export const VERY_SLOW_LOAD_MS = 9_000;
export const SLOW_SHARE_LIMIT = 0.05;
/** Too few loads say nothing about a percentile. */
export const MIN_LOADS_FOR_ALERT = 40;

export interface Heartbeat {
  job: string;
  lastRunAt: Date;
  lastSuccessAt: Date | null;
  lastError: string | null;
}

export type StaleReason = "never_succeeded" | "no_success_within_interval" | "never_reported";

export interface StaleJob {
  job: string;
  reason: StaleReason;
  /** Hours since the last success, or null when there never was one. */
  hoursSinceSuccess: number | null;
  /** True when the route is still being called but failing, so pg_cron is fine and the job itself is not. */
  stillCalled: boolean;
  lastError: string | null;
}

/**
 * Jobs that have gone too long without a success. A job with no heartbeat at all is only reported once
 * monitor-health has been running long enough (`watchedForMs`) that the job must have been due, so a fresh
 * deploy does not alert.
 */
export function staleJobs(beats: Heartbeat[], now: Date, watchedForMs: number, expected: Record<string, number> = EXPECTED_INTERVAL_MS): StaleJob[] {
  const byJob = new Map(beats.map((b) => [b.job, b]));
  const out: StaleJob[] = [];
  for (const [job, interval] of Object.entries(expected)) {
    const beat = byJob.get(job);
    if (!beat) {
      if (watchedForMs >= interval + HEALTH_CHECK_EVERY_MS) out.push({ job, reason: "never_reported", hoursSinceSuccess: null, stillCalled: false, lastError: null });
      continue;
    }
    const sinceRun = now.getTime() - beat.lastRunAt.getTime();
    if (!beat.lastSuccessAt) {
      // Only alert once the failures have outlasted the interval, not on the first failed call.
      if (watchedForMs >= interval) out.push({ job, reason: "never_succeeded", hoursSinceSuccess: null, stillCalled: sinceRun < interval, lastError: beat.lastError });
      continue;
    }
    const since = now.getTime() - beat.lastSuccessAt.getTime();
    if (since > interval) out.push({ job, reason: "no_success_within_interval", hoursSinceSuccess: Math.round(since / HOUR), stillCalled: sinceRun < interval, lastError: beat.lastError });
  }
  return out;
}

export interface DayCount {
  page: string;
  loads: number;
  slow: number;
  verySlow: number;
}

export interface SlowPage {
  page: string;
  loads: number;
  slow: number;
  verySlow: number;
  slowShare: number;
}

/** Pages where the share of loads at or over 3 s exceeds 5% (the 95th percentile is over 3 s), summed over the rows given. */
export function slowPages(rows: DayCount[]): SlowPage[] {
  const total = new Map<string, DayCount>();
  for (const r of rows) {
    const t = total.get(r.page) ?? { page: r.page, loads: 0, slow: 0, verySlow: 0 };
    t.loads += r.loads;
    t.slow += r.slow;
    t.verySlow += r.verySlow;
    total.set(r.page, t);
  }
  return [...total.values()]
    .filter((t) => t.loads >= MIN_LOADS_FOR_ALERT && t.slow / t.loads > SLOW_SHARE_LIMIT)
    .map((t) => ({ ...t, slowShare: Math.round((t.slow / t.loads) * 1000) / 1000 }));
}

/** Records one call of a monitor job. Never throws: a heartbeat must not turn a good run into a failure. */
export async function recordHeartbeat(job: string, ok: boolean, error?: string, now: Date = new Date()): Promise<void> {
  try {
    const msg = ok ? null : (error ?? "failed").slice(0, 300);
    await prisma.monitorHeartbeat.upsert({
      where: { job },
      create: { job, lastRunAt: now, lastSuccessAt: ok ? now : null, lastError: msg, runs: 1 },
      update: { lastRunAt: now, ...(ok ? { lastSuccessAt: now, lastError: null } : { lastError: msg }), runs: { increment: 1 } },
    });
  } catch (err) {
    log.warn("could not record heartbeat", { job, err: err instanceof Error ? err.message : String(err) });
  }
}

/** Counts one page load for today. Fire-and-forget; a lost count only thins the sample. */
export async function recordPageLoad(page: string, totalMs: number): Promise<void> {
  const slow = totalMs >= SLOW_LOAD_MS ? 1 : 0;
  const verySlow = totalMs >= VERY_SLOW_LOAD_MS ? 1 : 0;
  try {
    await prisma.$executeRaw`
      INSERT INTO page_timing_days (day, page, loads, slow, very_slow)
      VALUES (CURRENT_DATE, ${page}, 1, ${slow}, ${verySlow})
      ON CONFLICT (day, page) DO UPDATE
      SET loads = page_timing_days.loads + 1, slow = page_timing_days.slow + ${slow}, very_slow = page_timing_days.very_slow + ${verySlow}`;
  } catch (err) {
    log.warn("could not record page timing", { page, err: err instanceof Error ? err.message : String(err) });
  }
}

/** The monitor-health job: reads the heartbeats and the last two days of page timings and reports what is wrong. */
export async function runMonitorHealth(now: Date = new Date()): Promise<{ stale: StaleJob[]; slow: SlowPage[] }> {
  const beats = await prisma.monitorHeartbeat.findMany();
  // monitor-health records itself after this runs, so its own row says how long it has been watching.
  const self = beats.find((b) => b.job === "monitor-health");
  const watchedForMs = self ? (self.runs - 1) * HEALTH_CHECK_EVERY_MS : 0;
  const stale = staleJobs(beats.filter((b) => b.job !== "monitor-health"), now, watchedForMs);

  const since = new Date(now.getTime() - 2 * DAY);
  const days = await prisma.pageTimingDay.findMany({ where: { day: { gte: since } } });
  const slow = slowPages(days);

  for (const s of stale) log.error("scheduled monitor is stale", { ...s });
  for (const p of slow) log.error("dashboard loads slow: more than 5% took 3 s or more", { ...p });
  return { stale, slow };
}
