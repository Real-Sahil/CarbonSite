/**
 * Helper to broadcast dashboard updates to connected clients.
 * Called after calculation runs complete and dashboards are rebuilt.
 */

import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from "@/lib/db";
import { CATEGORY_BREAKDOWN_DIMENSIONS } from "@/lib/calculation/aggregate-filters";
import { broadcastDashboardUpdate as broadcast, type DashboardUpdate } from "@/lib/realtime/subscription-manager";

/**
 * Convert Prisma Decimal to number, handling precision loss gracefully.
 */
function decimalToNumber(value: Decimal | null | undefined): number {
  if (!value) return 0;
  return typeof value === 'number' ? value : parseFloat(value.toString());
}

/**
 * Broadcast updated dashboard aggregates to all connected SSE clients.
 * Called after a CalculationRun completes and DashboardAggregate rows are rebuilt.
 */
export async function broadcastDashboardUpdate(
  orgId: string,
  calculationRunId: string,
  reportingPeriodId?: string
): Promise<void> {
  try {
    // Fetch updated dashboard aggregates
    // Category rows only. They cover every calculation exactly once, so they
    // give both the scope totals and the per-category map from one query. The
    // unfiltered table also holds a scope rollup row, per-facility and
    // per-business-unit rows for the same emissions, plus a frozen copy under
    // every published snapshot, so summing it raw overstates several times over.
    const where = {
      organizationId: orgId,
      ...(reportingPeriodId ? { reportingPeriodId } : {}),
      snapshotId: null,
      ...CATEGORY_BREAKDOWN_DIMENSIONS,
    };

    const aggregates = await prisma.dashboardAggregate.findMany({
      where,
      select: {
        scope: true,
        totalCo2e: true,
        emissionCategoryId: true,
      },
    });

    // Summarize by scope and category
    let totalCo2e = 0;
    let scope1 = 0;
    let scope2 = 0;
    let scope3 = 0;
    const byCategory: Record<string, number> = {};

    for (const agg of aggregates) {
      const co2eNum = decimalToNumber(agg.totalCo2e);
      totalCo2e += co2eNum;

      if (agg.scope === 1) {
        scope1 += co2eNum;
      } else if (agg.scope === 2) {
        scope2 += co2eNum;
      } else if (agg.scope === 3) {
        scope3 += co2eNum;
      }

      if (agg.emissionCategoryId) {
        byCategory[agg.emissionCategoryId] =
          (byCategory[agg.emissionCategoryId] ?? 0) + co2eNum;
      }
    }

    // Broadcast to all connected clients
    const update: DashboardUpdate = {
      type: "calculation_progress",
      organizationId: orgId,
      timestamp: new Date().toISOString(),
      data: {
        aggregates: {
          totalCo2e,
          scope1,
          scope2,
          scope3,
          byCategory,
        },
        calculationRunId,
      },
    };

    broadcast(update);
  } catch (err) {
    console.error(
      `Failed to broadcast dashboard update for org ${orgId}: ${err}`
    );
    // Don't throw — broadcast failures shouldn't block calculation completion
  }
}

/**
 * Get dashboard data for initial page load (before SSE connection).
 * Returns current state so component can display data while connecting.
 */
export async function getDashboardSnapshot(
  orgId: string,
  reportingPeriodId?: string
): Promise<{ aggregates: { totalCo2e: number; scope1: number; scope2: number; scope3: number; byCategory: Record<string, number> }; timestamp: string } | null> {
  try {
    // Category rows only. They cover every calculation exactly once, so they
    // give both the scope totals and the per-category map from one query. The
    // unfiltered table also holds a scope rollup row, per-facility and
    // per-business-unit rows for the same emissions, plus a frozen copy under
    // every published snapshot, so summing it raw overstates several times over.
    const where = {
      organizationId: orgId,
      ...(reportingPeriodId ? { reportingPeriodId } : {}),
      snapshotId: null,
      ...CATEGORY_BREAKDOWN_DIMENSIONS,
    };

    const aggregates = await prisma.dashboardAggregate.findMany({
      where,
      select: {
        scope: true,
        totalCo2e: true,
        emissionCategoryId: true,
      },
    });

    let totalCo2e = 0;
    let scope1 = 0;
    let scope2 = 0;
    let scope3 = 0;
    const byCategory: Record<string, number> = {};

    for (const agg of aggregates) {
      const co2eNum = decimalToNumber(agg.totalCo2e);
      totalCo2e += co2eNum;

      if (agg.scope === 1) {
        scope1 += co2eNum;
      } else if (agg.scope === 2) {
        scope2 += co2eNum;
      } else if (agg.scope === 3) {
        scope3 += co2eNum;
      }

      if (agg.emissionCategoryId) {
        byCategory[agg.emissionCategoryId] =
          (byCategory[agg.emissionCategoryId] ?? 0) + co2eNum;
      }
    }

    return {
      aggregates: {
        totalCo2e,
        scope1,
        scope2,
        scope3,
        byCategory,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error(
      `Failed to fetch dashboard snapshot for org ${orgId}: ${err}`
    );
    return null;
  }
}
