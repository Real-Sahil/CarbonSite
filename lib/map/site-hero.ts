// What a pin on the dashboard hero does to the filters. A project site filters by that one site (`siteId`); an office or depot filters by its facility. Choosing a pin replaces any earlier
// site choice, and choosing the pin already chosen clears it, so one site is shown at a time.

import type { SiteTotal } from "./site-map";

export const SITE_FILTER_KEYS = ["siteId", "facilityId"] as const;

/** The filter this pin sets: a project site filters by that one site, an office or depot by its facility. */
export function pinFilter(site: Pick<SiteTotal, "kind" | "id" | "projectId">): { key: "siteId" | "facilityId"; value: string } {
  return site.kind === "site" ? { key: "siteId", value: site.id } : { key: "facilityId", value: site.id };
}

/** The filters after a pin is chosen. Choosing the active pin again clears the site choice. */
export function filtersAfterPin(current: Record<string, string>, site: Pick<SiteTotal, "kind" | "id" | "projectId">): Record<string, string> {
  const pin = pinFilter(site);
  const next = { ...current };
  for (const key of SITE_FILTER_KEYS) delete next[key];
  const active = current[pin.key] === pin.value;
  if (!active) next[pin.key] = pin.value;
  return next;
}

/** The filters after the fallback dropdown is set to a project, or cleared with an empty value. */
export function filtersAfterProject(current: Record<string, string>, projectId: string): Record<string, string> {
  const next = { ...current };
  delete next.facilityId;
  delete next.siteId;
  if (projectId) next.projectId = projectId;
  else delete next.projectId;
  return next;
}

export function toQuery(filters: Record<string, string>): string {
  const q = new URLSearchParams(filters).toString();
  return q ? `?${q}` : "";
}

/**
 * Pixel positions for pins, with pins that would land on the same spot spread around it in a small ring. The
 * spread is for display only: it never changes a site's position or its figures.
 */
export function spreadCoincident<T extends { x: number; y: number }>(points: T[], step = 6, ringRadius = 26): T[] {
  const groups = new Map<string, number[]>();
  points.forEach((p, i) => {
    const key = `${Math.round(p.x / step)}:${Math.round(p.y / step)}`;
    groups.set(key, [...(groups.get(key) ?? []), i]);
  });
  const out = points.map((p) => ({ ...p }));
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    members.forEach((idx, k) => {
      const angle = (2 * Math.PI * k) / members.length - Math.PI / 2;
      out[idx] = { ...out[idx], x: points[idx].x + ringRadius * Math.cos(angle), y: points[idx].y + ringRadius * Math.sin(angle) };
    });
  }
  return out;
}

export type CompareKey = "name" | "kg" | "recordCount" | "share";

/** Rows for the compare table. A share is of the same kind's total (offices and project sites overlap, so kinds are never added). */
export function compareRows(sites: SiteTotal[], key: CompareKey, dir: "asc" | "desc") {
  const kindTotal = (kind: string) => sites.filter((s) => (s.kind ?? "facility") === kind).reduce((a, s) => a + s.kg, 0);
  const rows = sites.map((s) => {
    const total = kindTotal(s.kind ?? "facility");
    return { site: s, share: total > 0 ? s.kg / total : null };
  });
  const value = (r: (typeof rows)[number]) => (key === "name" ? r.site.name.toLowerCase() : key === "kg" ? r.site.kg : key === "recordCount" ? r.site.recordCount : (r.share ?? -1));
  const sign = dir === "asc" ? 1 : -1;
  return rows.sort((a, b) => {
    const x = value(a), y = value(b);
    return (x < y ? -1 : x > y ? 1 : a.site.name.localeCompare(b.site.name)) * sign;
  });
}
