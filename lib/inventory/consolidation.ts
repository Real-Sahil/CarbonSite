// GHG Protocol Corporate Standard, Chapter 3 — organisational boundaries.
//
// The consolidation approach decides which legal entities roll up into the
// group inventory and at what share. Under the two control approaches an
// entity is consolidated at 100% or not at all. Under equity share it is
// consolidated in proportion to the equity held, and for entities held
// through intermediate holding companies that share is the product of the
// stakes down the chain.

import type { ConsolidationApproach } from "@prisma/client";

/** The subset of LegalEntity fields consolidation actually depends on. */
export interface ConsolidatableEntity {
  id: string;
  parentId: string | null;
  /** Equity held by the immediate parent, expressed 0-100. */
  ownershipPercent: number;
  operationalControl: boolean;
  financialControl: boolean;
  acquiredOn: Date | null;
  divestedOn: Date | null;
}

/** The subset of Facility fields consolidation depends on. */
export interface ConsolidatableFacility {
  id: string;
  legalEntityId: string | null;
  operationalControl: boolean;
  operationalFrom: Date | null;
  operationalTo: Date | null;
}

/**
 * Share of an entity's emissions attributable to the group, ignoring the
 * ownership chain above it. Returns a factor in [0, 1].
 */
export function directConsolidationFactor(
  approach: ConsolidationApproach,
  entity: Pick<
    ConsolidatableEntity,
    "ownershipPercent" | "operationalControl" | "financialControl"
  >,
): number {
  switch (approach) {
    case "operational_control":
      return entity.operationalControl ? 1 : 0;
    case "financial_control":
      return entity.financialControl ? 1 : 0;
    case "equity_share":
      return clampFactor(entity.ownershipPercent / 100);
  }
}

/**
 * Effective consolidation factor for every entity, accounting for the
 * ownership chain. Under equity share a 60%-held subsidiary that itself holds
 * 50% of a grandchild contributes 30% of the grandchild's emissions.
 *
 * Cycles in the parent chain (which the schema permits but the domain does
 * not) are broken by treating the entity as a root, so a malformed tree
 * degrades to a sensible number rather than hanging.
 */
export function resolveEffectiveShares(
  approach: ConsolidationApproach,
  entities: ConsolidatableEntity[],
): Map<string, number> {
  const byId = new Map(entities.map((e) => [e.id, e]));
  const resolved = new Map<string, number>();

  function factorFor(id: string, seen: Set<string>): number {
    const cached = resolved.get(id);
    if (cached !== undefined) return cached;

    const entity = byId.get(id);
    if (!entity) return 0;

    // A cycle, or a parent outside this org. Treat as a root.
    if (seen.has(id)) return directConsolidationFactor(approach, entity);
    seen.add(id);

    const own = directConsolidationFactor(approach, entity);

    // Control approaches are binary at each level and do not compound: an
    // entity is either inside the boundary or outside it.
    if (approach !== "equity_share") {
      resolved.set(id, own);
      return own;
    }

    const parentFactor =
      entity.parentId && byId.has(entity.parentId)
        ? factorFor(entity.parentId, seen)
        : 1;

    const effective = clampFactor(own * parentFactor);
    resolved.set(id, effective);
    return effective;
  }

  for (const entity of entities) factorFor(entity.id, new Set());
  return resolved;
}

/**
 * Whether an entity sat inside the reporting boundary on a given date.
 * Emissions before acquisition belong to the previous owner; emissions after
 * divestiture belong to the buyer.
 */
export function isEntityInBoundaryOn(
  entity: Pick<ConsolidatableEntity, "acquiredOn" | "divestedOn">,
  date: Date,
): boolean {
  if (entity.acquiredOn && date < startOfDay(entity.acquiredOn)) return false;
  if (entity.divestedOn && date > endOfDay(entity.divestedOn)) return false;
  return true;
}

/** Whether a facility sat inside the boundary on a given date. */
export function isFacilityInBoundaryOn(
  facility: Pick<ConsolidatableFacility, "operationalFrom" | "operationalTo">,
  date: Date,
): boolean {
  if (facility.operationalFrom && date < startOfDay(facility.operationalFrom)) return false;
  if (facility.operationalTo && date > endOfDay(facility.operationalTo)) return false;
  return true;
}

/**
 * Consolidation factor to apply to one facility's emissions on a given date.
 *
 * A facility inherits its share from the legal entity that owns it. A facility
 * with no legal entity is treated as wholly owned and directly operated, which
 * is the correct default for a single-entity organisation that has not modelled
 * a group structure.
 */
export function facilityConsolidationFactor(params: {
  approach: ConsolidationApproach;
  facility: ConsolidatableFacility;
  entities: ConsolidatableEntity[];
  effectiveShares: Map<string, number>;
  activityDate: Date;
}): number {
  const { approach, facility, entities, effectiveShares, activityDate } = params;

  if (!isFacilityInBoundaryOn(facility, activityDate)) return 0;

  // Under operational control a facility the group does not operate is out of
  // scope regardless of who owns the entity holding it.
  if (approach === "operational_control" && !facility.operationalControl) return 0;

  if (!facility.legalEntityId) return 1;

  const entity = entities.find((e) => e.id === facility.legalEntityId);
  if (!entity) return 1;

  if (!isEntityInBoundaryOn(entity, activityDate)) return 0;

  return effectiveShares.get(entity.id) ?? 0;
}

/**
 * Human-readable explanation of why a facility got the factor it did, for the
 * audit trail and the boundary UI. Assurance providers ask this question.
 */
export function explainFacilityFactor(params: {
  approach: ConsolidationApproach;
  facility: ConsolidatableFacility;
  entities: ConsolidatableEntity[];
  effectiveShares: Map<string, number>;
  activityDate: Date;
}): string {
  const { approach, facility, entities, activityDate } = params;

  if (!isFacilityInBoundaryOn(facility, activityDate)) {
    return "Excluded: activity date falls outside the facility's operational window.";
  }
  if (approach === "operational_control" && !facility.operationalControl) {
    return "Excluded: organisation does not hold operational control of this facility.";
  }
  if (!facility.legalEntityId) {
    return "Included at 100%: facility is not assigned to a legal entity, so it is treated as wholly owned and directly operated.";
  }

  const entity = entities.find((e) => e.id === facility.legalEntityId);
  if (!entity) {
    return "Included at 100%: assigned legal entity could not be resolved.";
  }
  if (!isEntityInBoundaryOn(entity, activityDate)) {
    return "Excluded: activity date falls outside the owning entity's period in the group.";
  }

  const factor = facilityConsolidationFactor(params);
  const pct = (factor * 100).toFixed(2).replace(/\.?0+$/, "");

  switch (approach) {
    case "operational_control":
      return factor > 0
        ? "Included at 100% under the operational control approach."
        : "Excluded: organisation does not hold operational control of the owning entity.";
    case "financial_control":
      return factor > 0
        ? "Included at 100% under the financial control approach."
        : "Excluded: organisation does not hold financial control of the owning entity.";
    case "equity_share":
      return `Included at ${pct}% under the equity share approach, being the product of equity stakes down the ownership chain.`;
  }
}

function clampFactor(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return n > 1 ? 1 : n;
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(23, 59, 59, 999);
  return copy;
}
