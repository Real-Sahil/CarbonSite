import type { Scope2Method } from "@prisma/client";

/**
 * The Scope 2 reporting method a record's emissions count under. The record's
 * own `scope2Method` wins (factor selection uses it); otherwise the category
 * decides, so a record filed under market-based electricity is never folded
 * into the location-based headline. Null for Scope 1 and 3.
 *
 * Dashboards and reports must both classify through this, or their Scope 2
 * totals diverge.
 */
export function scope2MethodOf(record: {
  scope2Method?: Scope2Method | null;
  emissionCategory: { scope: number; code?: string | null };
}): Scope2Method | null {
  if (record.emissionCategory.scope !== 2) return null;
  if (record.scope2Method) return record.scope2Method;
  return record.emissionCategory.code === "s2-electricity-mb" ? "market_based" : "location_based";
}

/** Headline inventory totals use location-based Scope 2; market-based is reported alongside, never added. */
export function countsTowardHeadline(method: Scope2Method | null): boolean {
  return method !== "market_based";
}
