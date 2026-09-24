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

/**
 * Purchased heat, steam and cooling has no separate market instrument here:
 * under the GHG Protocol its location-based figure also stands in the
 * market-based total. True for an s2-heat record whose method was not set
 * explicitly. Such records count in the market-based total only when the run
 * has market-based electricity, so a market-based figure is never heat alone.
 */
export function inBothScope2Totals(record: {
  scope2Method?: Scope2Method | null;
  emissionCategory: { scope: number; code?: string | null };
}): boolean {
  return record.emissionCategory.scope === 2 && record.emissionCategory.code === "s2-heat" && !record.scope2Method;
}

/** Headline inventory totals use location-based Scope 2; market-based is reported alongside, never added. */
export function countsTowardHeadline(method: Scope2Method | null): boolean {
  return method !== "market_based";
}
