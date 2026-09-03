/**
 * Phase 5E: Analytics Dashboard Cache Manager
 * Manages cache invalidation and updates for the advanced analytics dashboard.
 */

import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logging';

export interface DashboardCacheUpdate {
  organizationId: string;
  reportingPeriodId: string;
  forecastTotalCo2e?: number | null;
  forecastTrend?: string | null;
  forecastConfidence?: number | null;
  topDriverFeature?: string | null;
  topDriverPct?: number | null;
  top5Features?: Record<string, unknown>[] | null;
  recentAnomaliesCount?: number;
  unresolvedAnomaliesCount?: number;
  recentRootCauses?: Record<string, unknown>[] | null;
  scenarioResults?: Record<string, unknown>[] | null;
  lastForecastRun?: Date | null;
  lastExplanationRun?: Date | null;
  lastCausalAnalysis?: Date | null;
}

export class AnalyticsDashboardCacheManager {
  /**
   * Invalidate dashboard cache for an organization
   * Marks cache as expired to trigger refresh on next access
   */
  static async invalidateOrgCache(organizationId: string): Promise<void> {
    try {
      await prisma.analyticsDashboardCache.updateMany({
        where: { organizationId },
        data: {
          expiresAt: new Date(), // Expire immediately
        },
      });

      logger.info(`Dashboard cache invalidated for org: ${organizationId}`);
    } catch (error) {
      logger.error(`Error invalidating dashboard cache: ${error}`);
      throw error;
    }
  }

  /**
   * Invalidate cache for specific reporting period
   */
  static async invalidatePeriodCache(
    organizationId: string,
    reportingPeriodId: string
  ): Promise<void> {
    try {
      await prisma.analyticsDashboardCache.updateMany({
        where: { organizationId, reportingPeriodId },
        data: {
          expiresAt: new Date(),
        },
      });

      logger.info(
        `Dashboard cache invalidated for org: ${organizationId}, period: ${reportingPeriodId}`
      );
    } catch (error) {
      logger.error(`Error invalidating period cache: ${error}`);
      throw error;
    }
  }

  /**
   * Update dashboard cache with new data
   */
  static async updateCache(update: DashboardCacheUpdate): Promise<void> {
    try {
      const existingCache = await prisma.analyticsDashboardCache.findUnique({
        where: {
          organizationId_reportingPeriodId: {
            organizationId: update.organizationId,
            reportingPeriodId: update.reportingPeriodId,
          },
        },
      });

      if (existingCache) {
        // Update existing cache
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: Record<string, any> = {
          forecastTotalCo2e: update.forecastTotalCo2e ?? existingCache.forecastTotalCo2e,
          forecastTrend: update.forecastTrend ?? existingCache.forecastTrend,
          forecastConfidence:
            update.forecastConfidence ?? existingCache.forecastConfidence,
          topDriverFeature: update.topDriverFeature ?? existingCache.topDriverFeature,
          topDriverPct: update.topDriverPct ?? existingCache.topDriverPct,
          recentAnomaliesCount:
            update.recentAnomaliesCount ?? existingCache.recentAnomaliesCount,
          unresolvedAnomaliesCount:
            update.unresolvedAnomaliesCount ??
            existingCache.unresolvedAnomaliesCount,
          lastForecastRun: update.lastForecastRun ?? existingCache.lastForecastRun,
          lastExplanationRun:
            update.lastExplanationRun ?? existingCache.lastExplanationRun,
          lastCausalAnalysisRun:
            update.lastCausalAnalysis ?? existingCache.lastCausalAnalysisRun,
          cachedAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        };

        // Handle JSON fields separately to avoid null type issues
        if (update.top5Features !== undefined) updateData.topFiveFeatures = update.top5Features;
        else if (existingCache.topFiveFeatures !== null) updateData.topFiveFeatures = existingCache.topFiveFeatures;

        if (update.recentRootCauses !== undefined) updateData.recentRootCauses = update.recentRootCauses;
        else if (existingCache.recentRootCauses !== null) updateData.recentRootCauses = existingCache.recentRootCauses;

        if (update.scenarioResults !== undefined) updateData.scenarioResults = update.scenarioResults;
        else if (existingCache.scenarioResults !== null) updateData.scenarioResults = existingCache.scenarioResults;

        await prisma.analyticsDashboardCache.update({
          where: {
            organizationId_reportingPeriodId: {
              organizationId: update.organizationId,
              reportingPeriodId: update.reportingPeriodId,
            },
          },
          data: updateData,
        });
      } else {
        // Create new cache entry
        const createData: Prisma.AnalyticsDashboardCacheUncheckedCreateInput = {
          id: `cache_${update.organizationId}_${update.reportingPeriodId}_${Date.now()}`,
          organizationId: update.organizationId,
          reportingPeriodId: update.reportingPeriodId,
          forecastTotalCo2e: update.forecastTotalCo2e,
          forecastTrend: update.forecastTrend,
          forecastConfidence: update.forecastConfidence,
          topDriverFeature: update.topDriverFeature,
          topDriverPct: update.topDriverPct,
          recentAnomaliesCount: update.recentAnomaliesCount ?? 0,
          unresolvedAnomaliesCount: update.unresolvedAnomaliesCount ?? 0,
          lastForecastRun: update.lastForecastRun,
          lastExplanationRun: update.lastExplanationRun,
          lastCausalAnalysisRun: update.lastCausalAnalysis,
          cachedAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        };

        // Handle JSON fields - only include if defined; null must use Prisma.DbNull for nullable Json
        if (update.top5Features !== undefined) createData.topFiveFeatures = update.top5Features === null ? Prisma.DbNull : update.top5Features as Prisma.InputJsonValue;
        if (update.recentRootCauses !== undefined) createData.recentRootCauses = update.recentRootCauses === null ? Prisma.DbNull : update.recentRootCauses as Prisma.InputJsonValue;
        if (update.scenarioResults !== undefined) createData.scenarioResults = update.scenarioResults === null ? Prisma.DbNull : update.scenarioResults as Prisma.InputJsonValue;

        await prisma.analyticsDashboardCache.create({
          data: createData,
        });
      }

      logger.info(
        `Dashboard cache updated for org: ${update.organizationId}, period: ${update.reportingPeriodId}`
      );
    } catch (error) {
      logger.error(`Error updating dashboard cache: ${error}`);
      throw error;
    }
  }

  /**
   * Get dashboard cache (returns null if expired)
   */
  static async getCache(
    organizationId: string,
    reportingPeriodId: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any | null> {
    try {
      const cache = await prisma.analyticsDashboardCache.findUnique({
        where: {
          organizationId_reportingPeriodId: {
            organizationId,
            reportingPeriodId,
          },
        },
      });

      if (!cache) {
        return null;
      }

      // Check if cache is expired
      if (cache.expiresAt < new Date()) {
        logger.info(`Cache expired for org: ${organizationId}, period: ${reportingPeriodId}`);
        return null;
      }

      return cache;
    } catch (error) {
      logger.error(`Error retrieving dashboard cache: ${error}`);
      return null;
    }
  }

  /**
   * Refresh all dashboard caches for an organization
   * Called after major calculation runs or analytical operations
   */
  static async refreshOrgDashboards(organizationId: string): Promise<void> {
    try {
      // Get all active reporting periods for the org
      const periods = await prisma.reportingPeriod.findMany({
        where: { organizationId },
        orderBy: { endDate: 'desc' },
        take: 5, // Only refresh last 5 periods
      });

      // Collect forecast data
      const forecasts = await prisma.emissionsForecast.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });

      // Collect explanation data
      const explanations = await prisma.modelExplanation.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });

      // Collect causal analysis data
      const analyses = await prisma.causalAnalysis.findMany({
        where: { organizationId, status: 'pending_review' },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });

      // Update cache for each period
      for (const period of periods) {
        const topDrivers = explanations.length > 0
          ? (explanations[0].featureImportance as unknown as Record<string, unknown>[])?.slice(0, 5) || []
          : [];

        const update: DashboardCacheUpdate = {
          organizationId,
          reportingPeriodId: period.id,
          forecastTotalCo2e: forecasts[0]?.forecastData
            ? ((forecasts[0].forecastData as unknown as Record<string, unknown>[])[0]?.predicted_value as number | null) || null
            : null,
          forecastTrend: forecasts[0] ? 'stable' : null,
          forecastConfidence: forecasts[0]?.modelConfidence?.toNumber() || null,
          topDriverFeature:
            explanations[0]?.topDriverFeature || 'activity_volume',
          topDriverPct:
            explanations[0]?.topDriverContributionPct?.toNumber() || null,
          top5Features: topDrivers,
          recentAnomaliesCount: analyses.length,
          unresolvedAnomaliesCount: analyses.filter(
            (a) => a.status === 'pending_review'
          ).length,
          recentRootCauses: analyses
            .slice(0, 3)
            .map((a) => ({
              anomaly: a.anomalyType,
              primary_cause: a.primaryCause,
              confidence: a.primaryCauseConfidence?.toNumber() || 0,
            })),
          lastForecastRun: forecasts[0]?.createdAt || null,
          lastExplanationRun: explanations[0]?.createdAt || null,
          lastCausalAnalysis: analyses[0]?.createdAt || null,
        };

        await this.updateCache(update);
      }

      logger.info(`Refreshed dashboards for org: ${organizationId}`);
    } catch (error) {
      logger.error(`Error refreshing organization dashboards: ${error}`);
      // Don't throw - cache refresh failures shouldn't block operations
    }
  }

  /**
   * Calculate if cache needs refresh
   * Returns true if any underlying data is stale
   */
  static async shouldRefreshCache(
    organizationId: string,
    reportingPeriodId: string
  ): Promise<boolean> {
    try {
      const cache = await prisma.analyticsDashboardCache.findUnique({
        where: {
          organizationId_reportingPeriodId: {
            organizationId,
            reportingPeriodId,
          },
        },
      });

      if (!cache) {
        return true; // No cache, needs refresh
      }

      if (cache.expiresAt < new Date()) {
        return true; // Expired, needs refresh
      }

      // Check if underlying data is newer than cache
      const latestCalculation = await prisma.emissionCalculation.findFirst({
        where: {
          organizationId,
          activityRecord: {
            reportingPeriodId,
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (
        latestCalculation &&
        latestCalculation.createdAt > cache.cachedAt
      ) {
        return true; // New calculations, needs refresh
      }

      return false;
    } catch (error) {
      logger.error(`Error checking cache freshness: ${error}`);
      return true; // Assume needs refresh on error
    }
  }
}

export default AnalyticsDashboardCacheManager;
