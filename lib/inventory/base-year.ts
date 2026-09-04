// GHG Protocol Corporate Standard, Chapter 5 — base year and recalculation.
//
// A base year is the reference point every target and trend line is measured
// against. When the reporting group or the methodology changes, the base year
// must be recalculated so that like is compared with like. If the recalculated
// total moves by more than the organisation's significance threshold, the base
// year is restated and the change is disclosed.
//
// Structural changes that oblige a recalculation: acquisitions, divestitures,
// mergers, outsourcing and insourcing, methodology or factor changes, boundary
// changes, and discovery of material errors. Organic growth and decline do not.

import { prisma } from "@/lib/db";
import type { PrismaClient, StructuralChangeType } from "@prisma/client";

/** Changes that oblige recalculation. Organic change never appears here. */
const RECALCULATION_TRIGGERS: ReadonlySet<StructuralChangeType> = new Set<StructuralChangeType>([
  "acquisition",
  "divestiture",
  "merger",
  "outsourcing",
  "insourcing",
  "methodology_change",
  "boundary_change",
  "error_correction",
]);

export function triggersRecalculation(type: StructuralChangeType): boolean {
  return RECALCULATION_TRIGGERS.has(type);
}

export interface ScopeTotals {
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
}

export const ZERO_TOTALS: ScopeTotals = { scope1: 0, scope2: 0, scope3: 0, total: 0 };

type Db = PrismaClient | Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

/**
 * Scope totals for a reporting period, in tCO2e, read from the published
 * snapshot's aggregates. Falls back to the period's aggregates when no
 * snapshot has been published, so a draft base year still shows numbers.
 *
 * Reads DashboardAggregate rather than raw EmissionCalculation rows, per the
 * dashboard performance rule.
 */
export async function computePeriodTotals(
  organizationId: string,
  reportingPeriodId: string,
  db: Db = prisma,
): Promise<ScopeTotals> {
  const snapshot = await db.publishedSnapshot.findFirst({
    where: { organizationId, reportingPeriodId },
    orderBy: [{ version: "desc" }, { publishedAt: "desc" }],
    select: { id: true },
  });

  const aggregates = await db.dashboardAggregate.groupBy({
    by: ["scope"],
    where: {
      organizationId,
      reportingPeriodId,
      // Category-level rows only. Facility and business-unit rows describe the
      // same emissions sliced differently and would double count.
      emissionCategoryId: { not: null },
      facilityId: null,
      businessUnitId: null,
      ...(snapshot ? { snapshotId: snapshot.id } : {}),
    },
    _sum: { totalCo2e: true },
  });

  const totals: ScopeTotals = { ...ZERO_TOTALS };
  for (const row of aggregates) {
    const value = Number(row._sum.totalCo2e ?? 0);
    if (row.scope === 1) totals.scope1 += value;
    else if (row.scope === 2) totals.scope2 += value;
    else if (row.scope === 3) totals.scope3 += value;
  }
  totals.total = totals.scope1 + totals.scope2 + totals.scope3;
  return totals;
}

/**
 * Signed percentage change between two totals.
 * A move away from a zero baseline is treated as infinite change and reported
 * as 100%, which correctly reads as significant against any threshold.
 */
export function deltaPercent(previousTotal: number, restatedTotal: number): number {
  if (previousTotal === 0) return restatedTotal === 0 ? 0 : 100;
  return ((restatedTotal - previousTotal) / Math.abs(previousTotal)) * 100;
}

export function isSignificant(delta: number, thresholdPercent: number): boolean {
  return Math.abs(delta) >= Math.abs(thresholdPercent);
}

export interface RecalculationAssessment {
  previous: ScopeTotals;
  restated: ScopeTotals;
  deltaPercent: number;
  isSignificant: boolean;
  thresholdPercent: number;
  /** Plain-language account of the assessment, stored for the audit trail. */
  rationale: string;
}

/**
 * Assesses one structural change against the active base year.
 *
 * The restated total is the base year period recomputed under the current
 * boundary and methodology. Because the calculation engine already applies the
 * current consolidation and factor set, recomputing the period is exactly what
 * `computePeriodTotals` returns; the previously published figures are the ones
 * frozen on the base year record.
 */
export async function assessRecalculation(params: {
  organizationId: string;
  baseYearId: string;
  db?: Db;
}): Promise<RecalculationAssessment> {
  const db = params.db ?? prisma;

  const baseYear = await db.baseYear.findFirst({
    where: { id: params.baseYearId, organizationId: params.organizationId },
    select: {
      reportingPeriodId: true,
      significanceThresholdPercent: true,
      currentScope1Co2e: true,
      currentScope2Co2e: true,
      currentScope3Co2e: true,
      currentTotalCo2e: true,
    },
  });

  if (!baseYear) throw new Error("Base year not found for this organisation.");

  const previous: ScopeTotals = {
    scope1: Number(baseYear.currentScope1Co2e ?? 0),
    scope2: Number(baseYear.currentScope2Co2e ?? 0),
    scope3: Number(baseYear.currentScope3Co2e ?? 0),
    total: Number(baseYear.currentTotalCo2e ?? 0),
  };

  const restated = await computePeriodTotals(
    params.organizationId,
    baseYear.reportingPeriodId,
    db,
  );

  const threshold = Number(baseYear.significanceThresholdPercent);
  const delta = deltaPercent(previous.total, restated.total);
  const significant = isSignificant(delta, threshold);

  const direction = delta >= 0 ? "increase" : "decrease";
  const rationale = significant
    ? `Recalculated base year total is ${restated.total.toFixed(3)} tCO2e against a previously reported ${previous.total.toFixed(3)} tCO2e, a ${Math.abs(delta).toFixed(2)}% ${direction}. This meets or exceeds the ${threshold}% significance threshold, so the base year must be restated and the change disclosed.`
    : `Recalculated base year total is ${restated.total.toFixed(3)} tCO2e against a previously reported ${previous.total.toFixed(3)} tCO2e, a ${Math.abs(delta).toFixed(2)}% ${direction}. This falls below the ${threshold}% significance threshold, so the base year is left unchanged. The assessment is retained as evidence that the change was considered.`;

  return {
    previous,
    restated,
    deltaPercent: delta,
    isSignificant: significant,
    thresholdPercent: threshold,
    rationale,
  };
}

/**
 * Creates the recalculation assessment for a structural change against the
 * organisation's active base year, and records it.
 *
 * Returns null when there is no active base year, or when the change type does
 * not oblige a recalculation, so callers can enqueue this unconditionally.
 */
export async function createRecalculationForChange(params: {
  organizationId: string;
  structuralChangeId: string;
  createdByUserId: string;
  db?: Db;
}) {
  const db = params.db ?? prisma;

  const change = await db.structuralChange.findFirst({
    where: { id: params.structuralChangeId, organizationId: params.organizationId },
    select: { id: true, type: true },
  });
  if (!change || !triggersRecalculation(change.type)) return null;

  const baseYear = await db.baseYear.findFirst({
    where: { organizationId: params.organizationId, status: "active" },
    select: { id: true },
  });
  if (!baseYear) return null;

  const existing = await db.baseYearRecalculation.findUnique({
    where: {
      baseYearId_structuralChangeId: {
        baseYearId: baseYear.id,
        structuralChangeId: change.id,
      },
    },
  });
  if (existing) return existing;

  const assessment = await assessRecalculation({
    organizationId: params.organizationId,
    baseYearId: baseYear.id,
    db,
  });

  return db.baseYearRecalculation.create({
    data: {
      organizationId: params.organizationId,
      baseYearId: baseYear.id,
      structuralChangeId: change.id,
      status: assessment.isSignificant ? "awaiting_approval" : "not_significant",
      previousScope1Co2e: assessment.previous.scope1,
      previousScope2Co2e: assessment.previous.scope2,
      previousScope3Co2e: assessment.previous.scope3,
      previousTotalCo2e: assessment.previous.total,
      restatedScope1Co2e: assessment.restated.scope1,
      restatedScope2Co2e: assessment.restated.scope2,
      restatedScope3Co2e: assessment.restated.scope3,
      restatedTotalCo2e: assessment.restated.total,
      deltaPercent: assessment.deltaPercent,
      isSignificant: assessment.isSignificant,
      method: "Recomputation of the base year period under the current boundary and methodology.",
      notes: assessment.rationale,
      createdByUserId: params.createdByUserId,
    },
  });
}

/**
 * Applies an approved recalculation to the base year, moving the current
 * totals to the restated figures. The original totals are never touched, so
 * the full history of what was first published remains visible.
 */
export async function applyRecalculation(params: {
  organizationId: string;
  recalculationId: string;
  approvedByUserId: string;
  /// Needs the full client: the two writes must land atomically, so a
  /// transaction-scoped client cannot be passed in here.
  db?: PrismaClient;
}) {
  const db = params.db ?? prisma;

  const recalc = await db.baseYearRecalculation.findFirst({
    where: { id: params.recalculationId, organizationId: params.organizationId },
  });
  if (!recalc) throw new Error("Recalculation not found for this organisation.");
  if (recalc.status === "approved") return recalc;
  if (!recalc.isSignificant) {
    throw new Error(
      "This recalculation fell below the significance threshold and must not be applied.",
    );
  }

  const [updated] = await db.$transaction([
    db.baseYearRecalculation.update({
      where: { id: recalc.id },
      data: {
        status: "approved",
        approvedByUserId: params.approvedByUserId,
        approvedAt: new Date(),
      },
    }),
    db.baseYear.update({
      where: { id: recalc.baseYearId },
      data: {
        currentScope1Co2e: recalc.restatedScope1Co2e,
        currentScope2Co2e: recalc.restatedScope2Co2e,
        currentScope3Co2e: recalc.restatedScope3Co2e,
        currentTotalCo2e: recalc.restatedTotalCo2e,
      },
    }),
  ]);

  return updated;
}
