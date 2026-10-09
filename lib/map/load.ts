import { prisma } from "@/lib/db";
import { FACILITY_BREAKDOWN_DIMENSIONS, PRIMARY_SCOPE2_METHOD } from "@/lib/calculation/aggregate-filters";
import { geocodePostcodes } from "@/lib/social-value/geocode";
import { normalisePostcode, type LatLng } from "@/lib/social-value/local-spend";
import { projectSiteTotals, siteTotals, snapshotOrder, type SnapshotRef } from "./site-map";

// A postcode's position never changes, so a lookup is kept for the life of the server instance.
const postcodeCache = new Map<string, LatLng | null>();
async function positionsFor(postcodes: (string | null)[]) {
  const wanted = [...new Set(postcodes.map((p) => (p ? normalisePostcode(p) : null)).filter((p): p is string => p !== null))].filter((p) => !postcodeCache.has(p));
  if (wanted.length > 0) {
    try {
      for (const [k, v] of await geocodePostcodes(wanted)) postcodeCache.set(k, v);
    } catch {
      // postcodes.io unreachable: those sites stay unplaced for now and are not cached as failures.
    }
  }
  return (postcode: string | null) => {
    const key = postcode ? normalisePostcode(postcode) : null;
    return key ? postcodeCache.get(key) ?? null : null;
  };
}

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
  const [facilities, aggregates, projectSites, slices] = await Promise.all([
    prisma.facility.findMany({ where: { organizationId: orgId }, select: { id: true, name: true, postcode: true, latitude: true, longitude: true } }),
    prisma.dashboardAggregate.findMany({
      where: { organizationId: orgId, snapshotId: snap.id, ...FACILITY_BREAKDOWN_DIMENSIONS },
      select: { facilityId: true, totalCo2e: true, recordCount: true },
    }),
    prisma.site.findMany({ where: { organizationId: orgId }, select: { id: true, name: true, projectId: true, postcode: true, city: true, project: { select: { name: true } } } }),
    // One slice row per scope, method, category and month, so pin the Scope 2 method to count each calculation once.
    prisma.dashboardSlice.groupBy({
      by: ["siteId"],
      where: { organizationId: orgId, snapshotId: snap.id, siteId: { not: null }, ...PRIMARY_SCOPE2_METHOD },
      _sum: { totalCo2e: true, recordCount: true },
    }),
  ]);
  // A facility keeps the position a person chose; one with only a postcode is placed from it, as are project sites.
  const position = await positionsFor([...facilities.filter((f) => f.latitude == null || f.longitude == null).map((f) => f.postcode), ...projectSites.map((x) => x.postcode)]);
  const placedFacilities = facilities.map((f) => {
    if (f.latitude != null && f.longitude != null) return f;
    const p = position(f.postcode);
    return p ? { ...f, latitude: p.latitude, longitude: p.longitude } : f;
  });
  return [
    ...siteTotals(placedFacilities, aggregates),
    ...projectSiteTotals(
      projectSites.map((x) => ({ id: x.id, name: x.name, projectId: x.projectId, projectName: x.project?.name ?? null, postcode: x.postcode, city: x.city })),
      slices.map((r) => ({ siteId: r.siteId, totalCo2e: r._sum.totalCo2e, recordCount: r._sum.recordCount ?? 0 })),
      position,
    ),
  ];
}
