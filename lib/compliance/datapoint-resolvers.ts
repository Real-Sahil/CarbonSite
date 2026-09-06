// Named resolvers for the framework datapoint crosswalk.
//
// Each resolver answers one question against an organisation's real data:
// can this disclosure requirement actually be answered today, and from what.
// A datapoint with no resolver here is narrative and can only be marked
// satisfied by a human recording evidence (OrganizationDatapointStatus).
//
// Resolvers are deliberately conservative: "satisfied" only when the
// underlying data genuinely supports the claim, "partial" when some but not
// all of what the disclosure needs is present, and "gap" otherwise. A
// resolver that guesses generously would make "CSRD-ready" a slogan again,
// which is the exact thing this crosswalk exists to stop.

import type { PrismaClient } from "@prisma/client";
import { summariseProvenance } from "@/lib/inventory/provenance";

export interface ResolverResult {
  status: "satisfied" | "partial" | "gap" | "not_applicable";
  evidenceSummary: string;
}

type Resolver = (orgId: string, db: PrismaClient) => Promise<ResolverResult>;

async function scope1GrossEmissions(orgId: string, db: PrismaClient): Promise<ResolverResult> {
  const count = await db.dashboardAggregate.count({
    where: { organizationId: orgId, scope: 1, emissionCategoryId: { not: null } },
  });
  return count > 0
    ? { status: "satisfied", evidenceSummary: `${count} Scope 1 category aggregates published.` }
    : { status: "gap", evidenceSummary: "No published Scope 1 aggregates found." };
}

async function scope2DualReporting(orgId: string, db: PrismaClient): Promise<ResolverResult> {
  const methods = await db.dashboardAggregate.findMany({
    where: { organizationId: orgId, scope: 2, scope2Method: { not: null } },
    select: { scope2Method: true },
    distinct: ["scope2Method"],
  });
  const hasLocation = methods.some((m) => m.scope2Method === "location_based");
  const hasMarket = methods.some((m) => m.scope2Method === "market_based");
  if (hasLocation && hasMarket) {
    return { status: "satisfied", evidenceSummary: "Both location-based and market-based Scope 2 figures are published." };
  }
  if (hasLocation || hasMarket) {
    return {
      status: "partial",
      evidenceSummary: `Only ${hasLocation ? "location-based" : "market-based"} Scope 2 is published; the dual-reporting requirement needs both.`,
    };
  }
  return { status: "gap", evidenceSummary: "No Scope 2 figures published under either method." };
}

async function scope3CategoriesDisclosed(orgId: string, db: PrismaClient): Promise<ResolverResult> {
  const categories = await db.emissionCategory.findMany({
    where: { scope: 3 },
    select: { id: true, code: true },
  });
  if (categories.length === 0) {
    return { status: "gap", evidenceSummary: "No Scope 3 categories are configured." };
  }
  const withData = await db.activityRecord.groupBy({
    by: ["emissionCategoryId"],
    where: { organizationId: orgId, emissionCategoryId: { in: categories.map((c) => c.id) } },
  });
  const coveredCount = withData.length;
  if (coveredCount === 0) {
    return { status: "gap", evidenceSummary: "No Scope 3 activity data recorded in any category." };
  }
  if (coveredCount < categories.length) {
    return {
      status: "partial",
      evidenceSummary: `${coveredCount} of ${categories.length} Scope 3 categories have recorded activity data.`,
    };
  }
  return { status: "satisfied", evidenceSummary: `All ${categories.length} configured Scope 3 categories have recorded activity data.` };
}

async function baseYearEstablished(orgId: string, db: PrismaClient): Promise<ResolverResult> {
  const active = await db.baseYear.findFirst({
    where: { organizationId: orgId, status: "active" },
    select: { label: true, reportingPeriod: { select: { label: true } } },
  });
  return active
    ? { status: "satisfied", evidenceSummary: `Active base year "${active.label}" (${active.reportingPeriod.label}).` }
    : { status: "gap", evidenceSummary: "No active base year is declared." };
}

async function baseYearRecalculationPolicy(orgId: string, db: PrismaClient): Promise<ResolverResult> {
  const active = await db.baseYear.findFirst({
    where: { organizationId: orgId, status: "active" },
    select: { significanceThresholdPercent: true },
  });
  if (!active) return { status: "gap", evidenceSummary: "No active base year, so no recalculation policy exists yet." };
  return {
    status: "satisfied",
    evidenceSummary: `Recalculation policy set: restate when the base year total moves by ${Number(active.significanceThresholdPercent)}% or more.`,
  };
}

async function organizationalBoundaryDisclosed(orgId: string, db: PrismaClient): Promise<ResolverResult> {
  const org = await db.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: { consolidationApproach: true },
  });
  const entityCount = await db.legalEntity.count({ where: { organizationId: orgId } });
  return {
    status: "satisfied",
    evidenceSummary:
      entityCount > 0
        ? `Consolidation approach "${org.consolidationApproach}" declared across ${entityCount} legal ${entityCount === 1 ? "entity" : "entities"}.`
        : `Consolidation approach "${org.consolidationApproach}" declared. No group structure modelled, treated as a single reporting entity.`,
  };
}

async function targetsDisclosed(orgId: string, db: PrismaClient): Promise<ResolverResult> {
  const count = await db.reductionTarget.count({ where: { organizationId: orgId } });
  return count > 0
    ? { status: "satisfied", evidenceSummary: `${count} reduction target${count === 1 ? "" : "s"} recorded.` }
    : { status: "gap", evidenceSummary: "No reduction targets recorded." };
}

async function sbtiTargetDisclosed(orgId: string, db: PrismaClient): Promise<ResolverResult> {
  const target = await db.sbtiTarget.findUnique({ where: { organizationId: orgId } });
  return target
    ? { status: "satisfied", evidenceSummary: "Science Based Targets initiative pathway recorded." }
    : { status: "gap", evidenceSummary: "No SBTi-aligned target recorded." };
}

async function intensityMetricsDisclosed(orgId: string, db: PrismaClient): Promise<ResolverResult> {
  const row = await db.dashboardAggregate.findFirst({
    where: {
      organizationId: orgId,
      OR: [
        { intensityPerRevenueUnit: { not: null } },
        { intensityPerFte: { not: null } },
        { intensityPerM2: { not: null } },
      ],
    },
    select: { id: true },
  });
  return row
    ? { status: "satisfied", evidenceSummary: "At least one intensity metric is published alongside absolute emissions." }
    : { status: "gap", evidenceSummary: "No intensity metrics published." };
}

async function assuranceStatementDisclosed(orgId: string, db: PrismaClient): Promise<ResolverResult> {
  const signed = await db.assuranceEngagement.findFirst({
    where: { organizationId: orgId, status: "signed" },
    select: { level: true, standard: true, providerName: true },
  });
  if (signed) {
    return {
      status: "satisfied",
      evidenceSummary: `${signed.level} assurance opinion issued by ${signed.providerName} under ${signed.standard}.`,
    };
  }
  const inProgress = await db.assuranceEngagement.findFirst({
    where: { organizationId: orgId, status: { in: ["planning", "fieldwork", "review"] } },
    select: { id: true },
  });
  return inProgress
    ? { status: "partial", evidenceSummary: "An assurance engagement is underway but no opinion has been issued yet." }
    : { status: "gap", evidenceSummary: "No assurance engagement recorded." };
}

async function primaryDataShareDisclosed(orgId: string, db: PrismaClient): Promise<ResolverResult> {
  const calculations = await db.emissionCalculation.findMany({
    where: { organizationId: orgId },
    select: { totalCo2e: true, activityRecord: { select: { dataOrigin: true } } },
    take: 10_000,
  });
  if (calculations.length === 0) {
    return { status: "gap", evidenceSummary: "No emission calculations to assess data provenance from." };
  }
  const summary = summariseProvenance(
    calculations.map((c) => ({ dataOrigin: c.activityRecord.dataOrigin, totalCo2e: Number(c.totalCo2e) })),
  );
  if (summary.primaryDataPercent >= 70) {
    return {
      status: "satisfied",
      evidenceSummary: `${summary.primaryDataPercent.toFixed(1)}% of emissions are backed by primary data (metered, invoiced or supplier-specific).`,
    };
  }
  if (summary.primaryDataPercent > 0) {
    return {
      status: "partial",
      evidenceSummary: `${summary.primaryDataPercent.toFixed(1)}% of emissions are backed by primary data; the rest relies on estimates or proxies.`,
    };
  }
  return { status: "gap", evidenceSummary: "No emissions are backed by primary data." };
}

async function transitionPlanDisclosed(orgId: string, db: PrismaClient): Promise<ResolverResult> {
  const count = await db.reductionInitiative.count({ where: { organizationId: orgId } });
  if (count === 0) return { status: "gap", evidenceSummary: "No reduction initiatives recorded." };
  const quantified = await db.reductionInitiative.count({
    where: { organizationId: orgId, expectedImpactCo2e: { not: null } },
  });
  if (quantified === count) {
    return { status: "satisfied", evidenceSummary: `${count} reduction initiatives recorded, all with a quantified expected impact.` };
  }
  return {
    status: "partial",
    evidenceSummary: `${count} reduction initiatives recorded, ${quantified} with a quantified expected impact.`,
  };
}

async function restatementDisclosed(orgId: string, db: PrismaClient): Promise<ResolverResult> {
  const materialUndisclosed = await db.restatement.findFirst({
    where: { organizationId: orgId, isMaterial: true, disclosedAt: null },
    select: { id: true },
  });
  if (materialUndisclosed) {
    return { status: "gap", evidenceSummary: "A material restatement has not yet been marked as disclosed." };
  }
  const total = await db.restatement.count({ where: { organizationId: orgId } });
  return {
    status: "satisfied",
    evidenceSummary: total > 0 ? `${total} restatement${total === 1 ? "" : "s"} recorded, none with an outstanding material disclosure.` : "No restatements have been necessary.",
  };
}

async function offsetsDisclosed(orgId: string, db: PrismaClient): Promise<ResolverResult> {
  const count = await db.carbonOffset.count({ where: { organizationId: orgId } });
  return count > 0
    ? { status: "satisfied", evidenceSummary: `${count} carbon offset or removal ${count === 1 ? "purchase" : "purchases"} recorded.` }
    : { status: "not_applicable", evidenceSummary: "No offsets or removals recorded; not applicable unless the organisation makes a net-zero claim relying on them." };
}

/// The combined Scope 1/2/3 total that ESRS E1-6, IFRS S2-29 and most CDP and
/// SECR questions all ultimately ask for in one figure.
async function allScopesDisclosed(orgId: string, db: PrismaClient): Promise<ResolverResult> {
  const [s1, s2, s3result] = await Promise.all([
    scope1GrossEmissions(orgId, db),
    scope2DualReporting(orgId, db),
    scope3CategoriesDisclosed(orgId, db),
  ]);
  const statuses = [s1.status, s2.status, s3result.status];
  if (statuses.every((s) => s === "satisfied")) {
    return { status: "satisfied", evidenceSummary: "All three scopes are published: " + [s1, s2, s3result].map((r) => r.evidenceSummary).join(" ") };
  }
  if (statuses.every((s) => s === "gap")) {
    return { status: "gap", evidenceSummary: "No scope has published emissions data." };
  }
  return {
    status: "partial",
    evidenceSummary: [s1, s2, s3result].map((r, i) => `Scope ${i + 1}: ${r.evidenceSummary}`).join(" "),
  };
}

async function waterMetricsDisclosed(orgId: string, db: PrismaClient): Promise<ResolverResult> {
  const metricTypes = await db.waterRecord.findMany({
    where: { organizationId: orgId },
    select: { metricType: true },
    distinct: ["metricType"],
  });
  const covered = new Set(metricTypes.map((m) => m.metricType));
  if (covered.size === 0) {
    return { status: "gap", evidenceSummary: "No water records recorded." };
  }
  if (covered.size < 3) {
    return { status: "partial", evidenceSummary: `${covered.size} of 3 water metrics recorded (${[...covered].join(", ")}).` };
  }
  return { status: "satisfied", evidenceSummary: "Withdrawal, discharge and consumption are all recorded." };
}

async function waterStressAssessed(orgId: string, db: PrismaClient): Promise<ResolverResult> {
  const facilitiesWithWater = await db.waterRecord.findMany({
    where: { organizationId: orgId },
    select: { facilityId: true },
    distinct: ["facilityId"],
  });
  if (facilitiesWithWater.length === 0) {
    return { status: "gap", evidenceSummary: "No facilities have recorded water data." };
  }
  const facilityIds = facilitiesWithWater.map((f) => f.facilityId);
  const assessedCount = await db.facility.count({
    where: { id: { in: facilityIds }, waterStressLevel: { not: null } },
  });
  if (assessedCount === 0) {
    return { status: "gap", evidenceSummary: "No facility with water data has a water-stress classification." };
  }
  if (assessedCount < facilityIds.length) {
    return {
      status: "partial",
      evidenceSummary: `${assessedCount} of ${facilityIds.length} facilities with water data are water-stress assessed.`,
    };
  }
  return {
    status: "satisfied",
    evidenceSummary: `All ${facilityIds.length} facilities with water data are water-stress assessed.`,
  };
}

async function wasteMetricsDisclosed(orgId: string, db: PrismaClient): Promise<ResolverResult> {
  const count = await db.wasteRecord.count({ where: { organizationId: orgId } });
  if (count === 0) return { status: "gap", evidenceSummary: "No waste records recorded." };
  const hazardousCount = await db.wasteRecord.count({ where: { organizationId: orgId, hazardous: true } });
  return {
    status: "satisfied",
    evidenceSummary: `${count} waste records recorded, ${hazardousCount} flagged hazardous.`,
  };
}

async function wasteDiversionDisclosed(orgId: string, db: PrismaClient): Promise<ResolverResult> {
  const routes = await db.wasteRecord.findMany({
    where: { organizationId: orgId },
    select: { disposalRoute: true },
    distinct: ["disposalRoute"],
  });
  if (routes.length === 0) return { status: "gap", evidenceSummary: "No waste records recorded." };
  const landfillOnly = routes.every((r) => r.disposalRoute.startsWith("landfill"));
  if (landfillOnly) {
    return {
      status: "partial",
      evidenceSummary: "All recorded waste is landfilled; no diversion (recycling/recovery) route recorded.",
    };
  }
  return {
    status: "satisfied",
    evidenceSummary: `${routes.length} distinct disposal routes recorded, including at least one diversion route.`,
  };
}

export const DATAPOINT_RESOLVERS: Record<string, Resolver> = {
  scope1_gross_emissions: scope1GrossEmissions,
  scope2_dual_reporting: scope2DualReporting,
  scope3_categories_disclosed: scope3CategoriesDisclosed,
  all_scopes_disclosed: allScopesDisclosed,
  base_year_established: baseYearEstablished,
  base_year_recalculation_policy: baseYearRecalculationPolicy,
  organizational_boundary_disclosed: organizationalBoundaryDisclosed,
  targets_disclosed: targetsDisclosed,
  sbti_target_disclosed: sbtiTargetDisclosed,
  intensity_metrics_disclosed: intensityMetricsDisclosed,
  assurance_statement_disclosed: assuranceStatementDisclosed,
  primary_data_share_disclosed: primaryDataShareDisclosed,
  transition_plan_disclosed: transitionPlanDisclosed,
  restatement_disclosed: restatementDisclosed,
  offsets_disclosed: offsetsDisclosed,
  water_metrics_disclosed: waterMetricsDisclosed,
  water_stress_assessed: waterStressAssessed,
  waste_metrics_disclosed: wasteMetricsDisclosed,
  waste_diversion_disclosed: wasteDiversionDisclosed,
};

export async function runResolver(
  resolverKey: string,
  orgId: string,
  db: PrismaClient,
): Promise<ResolverResult | null> {
  const resolver = DATAPOINT_RESOLVERS[resolverKey];
  if (!resolver) return null;
  return resolver(orgId, db);
}
