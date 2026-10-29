import type { PrismaClient } from "@prisma/client";
import { runResolver } from "./datapoint-resolvers";
import { DISCLOSURE_REGIMES, readinessCounts, type DisclosureRegime, type ReadinessStatus } from "./regimes";

export type RegimeReadiness = ReturnType<typeof readinessCounts> & { regime: DisclosureRegime; label: string; total: number };

// Mirrors the crosswalk page: an automatic resolver result wins, else the organisation's manual status, else "gap".
// Resolvers run one after another because the connection pool holds a single connection per instance.
export async function loadRegimeReadiness(orgId: string, regime: DisclosureRegime, db: PrismaClient): Promise<RegimeReadiness> {
  const { label, framework } = DISCLOSURE_REGIMES[regime];
  const datapoints = await db.frameworkDatapoint.findMany({
    where: { framework },
    select: { id: true, resolverKey: true },
  });
  const overrides = await db.organizationDatapointStatus.findMany({
    where: { organizationId: orgId, datapointId: { in: datapoints.map((d) => d.id) } },
    select: { datapointId: true, status: true },
  });
  const manual = new Map(overrides.map((o) => [o.datapointId, o.status as ReadinessStatus]));
  const statuses: ReadinessStatus[] = [];
  for (const dp of datapoints) {
    const resolved = dp.resolverKey ? await runResolver(dp.resolverKey, orgId, db) : null;
    statuses.push(resolved ? resolved.status : manual.get(dp.id) ?? "gap");
  }
  return { regime, label, total: datapoints.length, ...readinessCounts(statuses) };
}
