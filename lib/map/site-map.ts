// Pure helpers for the site map: totals per site, which sites have a position,
// the order of published snapshots for the scrubber, and a projection for the
// schematic view shown when no tile source is configured.

/** A pin: an office or depot (`facility`) or a project site (`site`). Project sites carry their project so the map can link to it. */
export type SiteTotal = { id: string; name: string; latitude: number | null; longitude: number | null; kg: number; recordCount: number; kind?: "facility" | "site"; projectId?: string | null; detail?: string | null };
export type SnapshotRef = { id: string; label: string; version: number; publishedAt: string; periodStart: string };

type FacilityRow = { id: string; name: string; latitude: unknown; longitude: unknown };
type AggregateRow = { facilityId: string | null; totalCo2e: unknown; recordCount: number };

/** Every facility with its total (zero when it has none), summing the per-scope aggregate rows. */
export function siteTotals(facilities: FacilityRow[], aggregates: AggregateRow[]): SiteTotal[] {
  const totals = new Map<string, { kg: number; count: number }>();
  for (const a of aggregates) {
    if (!a.facilityId) continue;
    const t = totals.get(a.facilityId) ?? { kg: 0, count: 0 };
    t.kg += Number(a.totalCo2e);
    t.count += a.recordCount;
    totals.set(a.facilityId, t);
  }
  const num = (v: unknown) => (v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null);
  return facilities
    .map((f) => ({ id: f.id, name: f.name, latitude: num(f.latitude), longitude: num(f.longitude), kg: totals.get(f.id)?.kg ?? 0, recordCount: totals.get(f.id)?.count ?? 0, kind: "facility" as const }))
    .sort((a, b) => b.kg - a.kg || a.name.localeCompare(b.name));
}

type ProjectSiteRow = { id: string; name: string; projectId: string; projectName: string | null; postcode: string | null; city: string | null; latitude?: number | null; longitude?: number | null };
type SliceTotalRow = { siteId: string | null; totalCo2e: unknown; recordCount: number };

/**
 * Project sites with their totals from the snapshot's slices (zero when none). `positions` maps a normalised
 * postcode to coordinates; a site without a usable postcode stays unplaced rather than being guessed.
 */
export function projectSiteTotals(sites: ProjectSiteRow[], slices: SliceTotalRow[], positionOf: (postcode: string | null) => { latitude: number; longitude: number } | null): SiteTotal[] {
  const totals = new Map<string, { kg: number; count: number }>();
  for (const r of slices) {
    if (!r.siteId) continue;
    const t = totals.get(r.siteId) ?? { kg: 0, count: 0 };
    t.kg += Number(r.totalCo2e) || 0;
    t.count += r.recordCount;
    totals.set(r.siteId, t);
  }
  return sites
    .map((x) => {
      // A position chosen from address search wins over the postcode.
      const pos = x.latitude != null && x.longitude != null ? { latitude: x.latitude, longitude: x.longitude } : positionOf(x.postcode);
      return { id: x.id, name: x.name, latitude: pos?.latitude ?? null, longitude: pos?.longitude ?? null, kg: totals.get(x.id)?.kg ?? 0, recordCount: totals.get(x.id)?.count ?? 0, kind: "site" as const, projectId: x.projectId, detail: [x.projectName, x.city].filter(Boolean).join(", ") || null };
    })
    .sort((a, b) => b.kg - a.kg || a.name.localeCompare(b.name));
}

export const hasPosition = (s: SiteTotal): s is SiteTotal & { latitude: number; longitude: number } =>
  s.latitude != null && s.longitude != null && Math.abs(s.latitude) <= 90 && Math.abs(s.longitude) <= 180;

/** Oldest period first, then the later version: the order the scrubber moves in. */
export function snapshotOrder<T extends SnapshotRef>(snapshots: T[]): T[] {
  return [...snapshots].sort((a, b) => a.periodStart.localeCompare(b.periodStart) || a.version - b.version || a.publishedAt.localeCompare(b.publishedAt));
}

/** Marker radius in pixels, area proportional to emissions. */
export function radiusFor(kg: number, maxKg: number, maxRadius = 28, minRadius = 5): number {
  if (!(kg > 0) || !(maxKg > 0)) return minRadius;
  return Math.max(minRadius, Math.sqrt(kg / maxKg) * maxRadius);
}

/** Equirectangular fit of positioned sites into a box, for the schematic. A single site sits in the middle. */
export function fitProjection(points: { latitude: number; longitude: number }[], width: number, height: number, pad = 40) {
  const lons = points.map((p) => p.longitude);
  const lats = points.map((p) => p.latitude);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons), minLat = Math.min(...lats), maxLat = Math.max(...lats);
  // Longitude degrees shrink with latitude; scale both axes the same.
  const midLat = (minLat + maxLat) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180);
  const spanX = Math.max((maxLon - minLon) * kx, 1e-6);
  const spanY = Math.max(maxLat - minLat, 1e-6);
  const scale = points.length < 2 ? 0 : Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanY);
  const offX = (width - spanX * scale) / 2, offY = (height - spanY * scale) / 2;
  return (p: { latitude: number; longitude: number }) => ({
    x: offX + (p.longitude - minLon) * kx * scale,
    y: height - (offY + (p.latitude - minLat) * scale),
  });
}
