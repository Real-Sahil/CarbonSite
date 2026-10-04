import { prisma } from "@/lib/db";
import { FACILITY_BREAKDOWN_DIMENSIONS } from "@/lib/calculation/aggregate-filters";
import { siteTotals, snapshotOrder, type SnapshotRef } from "./site-map";

/** The organisation's published snapshots, oldest period first. */
export async function loadSnapshotRefs(orgId: string): Promise<SnapshotRef[]> {
  const rows = await prisma.publishedSnapshot.findMany({
    where: { organizationId: orgId },
    select: { id: true, version: true, publishedAt: true, reportingPeriod: { select: { label: true, startDate: true } } },
  });
  return snapshotOrder(
    rows.map((r) => ({
      id: r.id,
      label: `${r.reportingPeriod.label} v${r.version}`,
      version: r.version,
      publishedAt: r.publishedAt.toISOString(),
      periodStart: r.reportingPeriod.startDate.toISOString(),
    })),
  );
}

/**
 * Per-site totals of one published snapshot, or null when the snapshot is not
 * this organisation's. Always read through the organisation in the where.
 */
export async function loadSnapshotSites(orgId: string, snapshotId: string) {
  const snap = await prisma.publishedSnapshot.findFirst({ where: { id: snapshotId, organizationId: orgId }, select: { id: true } });
  if (!snap) return null;
  const [facilities, aggregates] = await Promise.all([
    prisma.facility.findMany({ where: { organizationId: orgId }, select: { id: true, name: true, latitude: true, longitude: true } }),
    prisma.dashboardAggregate.findMany({
      where: { organizationId: orgId, snapshotId: snap.id, ...FACILITY_BREAKDOWN_DIMENSIONS },
      select: { facilityId: true, totalCo2e: true, recordCount: true },
    }),
  ]);
  return siteTotals(facilities, aggregates);
}
