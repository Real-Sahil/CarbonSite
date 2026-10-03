// Entity and country filters for the dashboard of a group. One organisation is
// one reporting group; a legal entity (with its subsidiaries) or a country is a
// filter inside it, expressed as the set of facilities it covers, which is how
// DashboardAggregate already scopes by contract.

import { countryIso2 } from "@/lib/calculation/geography";

export type ScopeEntity = { id: string; parentId: string | null };
export type ScopeFacility = { id: string; country: string | null; legalEntityId: string | null };

/** An entity's id plus every entity below it. A cycle in the data cannot loop. */
export function entityWithDescendants(entities: ScopeEntity[], rootId: string): Set<string> {
  const children = new Map<string, string[]>();
  for (const e of entities) if (e.parentId) children.set(e.parentId, [...(children.get(e.parentId) ?? []), e.id]);
  const seen = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(children.get(id) ?? []));
  }
  return seen;
}

/**
 * Facility ids covered by the chosen entity and/or country (both must hold),
 * or null when neither filter is set. A filter that matches nothing gives an
 * empty list, not null, so the dashboard shows zero rather than everything.
 */
export function facilityScope(
  facilities: ScopeFacility[],
  entities: ScopeEntity[],
  filter: { entityId?: string | null; country?: string | null },
): string[] | null {
  const entityIds = filter.entityId ? entityWithDescendants(entities, filter.entityId) : null;
  const country = filter.country ? countryIso2(filter.country) : null;
  if (!entityIds && !filter.country) return null;
  return facilities
    .filter((f) => (!entityIds || (f.legalEntityId != null && entityIds.has(f.legalEntityId))) && (!filter.country || (country != null && countryIso2(f.country) === country)))
    .map((f) => f.id);
}

/** Distinct countries (ISO-2) the facilities sit in, most facilities first. */
export function facilityCountries(facilities: ScopeFacility[]): string[] {
  const counts = new Map<string, number>();
  for (const f of facilities) {
    const c = countryIso2(f.country);
    if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c);
}
