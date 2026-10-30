// Keeps slow page loads in the database. Vercel's Hobby plan holds logs for one hour, so a slow load logged by
// stageTimer() was gone before anyone looked. Only the organisation id and timings are stored.

import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const log = createLogger("perf-samples");

const RETENTION_DAYS = 14;
/** One write in this many also prunes old rows, so no scheduled job is needed. */
const PRUNE_ONE_IN = 50;

export async function recordPerfSample(sample: {
  orgId: string;
  page: string;
  totalMs: number;
  stages: Record<string, number>;
}): Promise<void> {
  try {
    await prisma.perfSample.create({
      data: {
        organizationId: sample.orgId,
        page: sample.page,
        totalMs: sample.totalMs,
        stages: sample.stages,
      },
    });
    if (Math.random() < 1 / PRUNE_ONE_IN) {
      await prisma.perfSample.deleteMany({
        where: { createdAt: { lt: new Date(Date.now() - RETENTION_DAYS * 86_400_000) } },
      });
    }
  } catch (err) {
    // Timing is diagnostics: a failed write must never affect the page.
    log.warn("Could not record a slow page sample", { error: err instanceof Error ? err.message : String(err) });
  }
}
