import { z } from "zod";
import type { OrgRefs } from "@/lib/security/org-refs";

/**
 * Saved views: a named set of filters for one portal page, private to its owner
 * or shared with the organisation. A view stores the request, never results.
 * A page joins by adding itself to SURFACES with the filter keys it reads from
 * its URL; nothing else about a view changes.
 */
export const SURFACES = {
  dashboard: { path: "dashboard", filters: ["facilityId", "contractId", "entityId", "country"] },
} as const;

export type Surface = keyof typeof SURFACES;
export const SURFACE_KEYS = Object.keys(SURFACES) as [Surface, ...Surface[]];

/** Views one person may keep per page, so a script cannot fill the table. */
export const MAX_VIEWS_PER_USER_PER_SURFACE = 50;

const filterValue = z.string().trim().min(1).max(64);

const surface = z.enum(SURFACE_KEYS);
const name = z.string().trim().min(1, "Name the view.").max(80);
const filters = z.record(z.string(), filterValue);

export const createViewBody = z.object({
  surface,
  name,
  filters,
  shared: z.boolean().default(false),
});

export const updateViewBody = z
  .object({ name: name.optional(), filters: filters.optional(), shared: z.boolean().optional() })
  .refine((b) => b.name !== undefined || b.filters !== undefined || b.shared !== undefined, {
    message: "Nothing to change.",
  });

/**
 * The filters of a surface: only the keys that page reads, country as an ISO-2
 * code. Returns the cleaned filters, or a message when one is not allowed.
 */
export function checkFilters(
  surfaceKey: Surface,
  raw: Record<string, string>,
): { filters: Record<string, string> } | { error: string } {
  const allowed: readonly string[] = SURFACES[surfaceKey].filters;
  for (const key of Object.keys(raw)) {
    if (!allowed.includes(key)) return { error: `"${key}" is not a filter on this page.` };
  }
  if (raw.country !== undefined && !/^[A-Z]{2}$/.test(raw.country)) {
    return { error: "Country must be a two-letter code such as GB." };
  }
  return { filters: raw };
}

/** The ids in a view's filters that must belong to the organisation. */
export function filterRefs(filters: Record<string, string>): OrgRefs {
  return {
    facilityId: filters.facilityId,
    contractId: filters.contractId,
    legalEntityId: filters.entityId,
  };
}

/** The page address that opens a view. */
export function viewHref(orgId: string, surfaceKey: Surface, filters: Record<string, string>): string {
  const query = new URLSearchParams(filters).toString();
  return `/orgs/${orgId}/${SURFACES[surfaceKey].path}${query ? `?${query}` : ""}`;
}

/** Owners change their own views; an admin may also change a shared one. */
export function mayChangeView(view: { ownerUserId: string; shared: boolean }, userId: string, isAdmin: boolean): boolean {
  return view.ownerUserId === userId || (view.shared && isAdmin);
}

export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}
