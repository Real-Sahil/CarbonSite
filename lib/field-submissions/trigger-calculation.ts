// Auto-schedules a CalculationRun for a reporting period after a field
// submission is approved. Called fire-and-forget from both the single and
// bulk review routes so dashboard contributions appear automatically.

import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { dispatchCalculation } from "@/lib/jobs/dispatch";

export async function scheduleCalculationForPeriod(
  orgId: string,
  reportingPeriodId: string,
  triggeredByUserId: string,
): Promise<void> {
  // Don't start a new run if one is already queued or running for this period.
  const inFlight = await prisma.calculationRun.findFirst({
    where: {
      organizationId: orgId,
      reportingPeriodId,
      status: { in: ["queued", "running"] },
    },
    select: { id: true },
  });
  if (inFlight) return;

  const [methodology, factorLibrary] = await Promise.all([
    prisma.methodologyVersion.findFirst({ orderBy: { createdAt: "desc" }, select: { id: true } }),
    prisma.factorLibrary.findFirst({ orderBy: { createdAt: "desc" }, select: { id: true } }),
  ]);

  if (!methodology || !factorLibrary) {
    console.warn(
      `[auto-calc] No methodology or factor library found — cannot auto-trigger run for period ${reportingPeriodId}`,
    );
    return;
  }

  const triggerHash = createHash("sha256")
    .update(
      `auto:${orgId}:${reportingPeriodId}:${methodology.id}:${factorLibrary.id}:${Math.floor(Date.now() / 60_000)}`,
    )
    .digest("hex");

  let run: { id: string };
  try {
    run = await prisma.calculationRun.create({
      data: {
        organizationId: orgId,
        reportingPeriodId,
        methodologyVersionId: methodology.id,
        factorLibraryId: factorLibrary.id,
        triggeredByUserId,
        triggerHash,
        status: "queued",
      },
      select: { id: true },
    });
  } catch {
    // Duplicate triggerHash: another approval in the same minute already
    // enqueued a run for this period — no action needed.
    return;
  }

  await dispatchCalculation({ calculationRunId: run.id, orgId }).catch((err) => {
    console.error(
      `[auto-calc] Failed to dispatch calculation run ${run.id} for period ${reportingPeriodId}:`,
      err,
    );
  });
}
