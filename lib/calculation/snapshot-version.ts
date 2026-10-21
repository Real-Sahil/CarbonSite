import type { Prisma } from "@prisma/client";

/** Next snapshot version for a period. The advisory lock holds until the transaction ends, so two publishes cannot take the same number. */
export async function nextSnapshotVersion(tx: Prisma.TransactionClient, organizationId: string, reportingPeriodId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`snapshot:${organizationId}:${reportingPeriodId}`}))`;
  const latest = await tx.publishedSnapshot.findFirst({
    where: { organizationId, reportingPeriodId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  return (latest?.version ?? 0) + 1;
}
