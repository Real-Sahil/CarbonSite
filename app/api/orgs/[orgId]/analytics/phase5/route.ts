/**
 * Phase 5 Analytics Orchestration Endpoints
 * Routes for triggering forecasts, explanations, root cause analysis, and batch jobs
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireOrgMember } from '@/lib/auth/session';
import { handleRouteError } from '@/lib/validation/api';
import { z } from 'zod';
import { PythonOrchestrator } from '@/lib/jobs/python-orchestrator';
import { AnalyticsDashboardCacheManager } from '@/lib/analytics/dashboard-cache-manager';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logging';

// Schema validation
const ForecastRequestSchema = z.object({
  facilityId: z.string(),
  categoryId: z.string(),
});

const ExplanationRequestSchema = z.object({
  emissionCalculationId: z.string(),
});

const RootCauseRequestSchema = z.object({
  facilityId: z.string(),
});

const BatchJobRequestSchema = z.object({
  jobType: z.enum([
    'forecast_generation',
    'explanation_generation',
    'causal_analysis',
  ]),
});

interface Params {
  params: Promise<{ orgId: string }>;
}

/**
 * POST /api/orgs/[orgId]/analytics/phase5/forecast
 * POST /api/orgs/[orgId]/analytics/phase5/explain
 * POST /api/orgs/[orgId]/analytics/phase5/root-cause
 * POST /api/orgs/[orgId]/analytics/phase5/batch
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const pathname = req.nextUrl.pathname;

    if (pathname.includes('/forecast')) {
      return handleForecast(req, orgId);
    } else if (pathname.includes('/explain')) {
      return handleExplanation(req, orgId);
    } else if (pathname.includes('/root-cause')) {
      return handleRootCause(req, orgId);
    } else if (pathname.includes('/batch')) {
      return handleBatchJob(req, orgId);
    }

    return NextResponse.json(
      { code: 'NOT_FOUND', message: 'Endpoint not found' },
      { status: 404 }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * Handle forecast request
 */
async function handleForecast(req: NextRequest, orgId: string) {
  try {
    await requireOrgMember(orgId, 'admin', 'editor');

    const body = await req.json();
    const { facilityId, categoryId } = ForecastRequestSchema.parse(body);

    logger.info(`Triggering forecast for org=${orgId}, facility=${facilityId}`);

    // Check if Python environment is available
    const pythonAvailable = await PythonOrchestrator.checkPythonEnvironment();
    if (!pythonAvailable) {
      return NextResponse.json(
        {
          code: 'PYTHON_UNAVAILABLE',
          message: 'Python ML environment not configured',
          details: 'Install Python and required packages: pip install -r requirements.txt',
        },
        { status: 503 }
      );
    }

    // Queue the forecast job
    const result = await PythonOrchestrator.queueForecast(
      orgId,
      facilityId,
      categoryId
    );

    if (!result.success) {
      return NextResponse.json(
        {
          code: 'FORECAST_FAILED',
          message: 'Failed to generate forecast',
          details: result.error,
        },
        { status: 500 }
      );
    }

    // Invalidate dashboard cache
    await AnalyticsDashboardCacheManager.invalidateOrgCache(orgId);

    return NextResponse.json({
      success: true,
      message: 'Forecast job queued successfully',
      jobType: 'forecast_generation',
      orgId,
      facilityId,
      categoryId,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * Handle explanation request
 */
async function handleExplanation(req: NextRequest, orgId: string) {
  try {
    await requireOrgMember(orgId, 'admin', 'editor');

    const body = await req.json();
    const { emissionCalculationId } = ExplanationRequestSchema.parse(body);

    logger.info(
      `Triggering explainability for org=${orgId}, calc=${emissionCalculationId}`
    );

    const result = await PythonOrchestrator.queueExplanation(
      orgId,
      emissionCalculationId
    );

    if (!result.success) {
      return NextResponse.json(
        {
          code: 'EXPLANATION_FAILED',
          message: 'Failed to generate explanations',
          details: result.error,
        },
        { status: 500 }
      );
    }

    await AnalyticsDashboardCacheManager.invalidateOrgCache(orgId);

    return NextResponse.json({
      success: true,
      message: 'Explainability job queued successfully',
      jobType: 'explanation_generation',
      orgId,
      emissionCalculationId,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * Handle root cause analysis request
 */
async function handleRootCause(req: NextRequest, orgId: string) {
  try {
    await requireOrgMember(orgId, 'admin', 'editor', 'reviewer');

    const body = await req.json();
    const { facilityId } = RootCauseRequestSchema.parse(body);

    logger.info(
      `Triggering root cause analysis for org=${orgId}, facility=${facilityId}`
    );

    const result = await PythonOrchestrator.queueRootCauseAnalysis(
      orgId,
      facilityId
    );

    if (!result.success) {
      return NextResponse.json(
        {
          code: 'ANALYSIS_FAILED',
          message: 'Failed to perform root cause analysis',
          details: result.error,
        },
        { status: 500 }
      );
    }

    await AnalyticsDashboardCacheManager.invalidateOrgCache(orgId);

    return NextResponse.json({
      success: true,
      message: 'Root cause analysis job queued successfully',
      jobType: 'causal_analysis',
      orgId,
      facilityId,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * Handle batch job request
 */
async function handleBatchJob(req: NextRequest, orgId: string) {
  try {
    await requireOrgMember(orgId, 'admin');

    const body = await req.json();
    const { jobType } = BatchJobRequestSchema.parse(body);

    logger.info(`Triggering batch job for org=${orgId}, type=${jobType}`);

    // Create batch job in database
    const batchJob = await prisma.batchJob.create({
      data: {
        id: `batch_${orgId}_${jobType}_${Date.now()}`,
        organizationId: orgId,
        jobType,
        status: 'queued',
        totalItems: 0,
        processedItems: 0,
        batchSize: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const result = await PythonOrchestrator.queueBatchJob(orgId, jobType);

    if (!result.success) {
      await prisma.batchJob.update({
        where: { id: batchJob.id },
        data: {
          status: 'failed',
          errorMessage: result.error,
          completedAt: new Date(),
        },
      });

      return NextResponse.json(
        {
          code: 'BATCH_FAILED',
          message: 'Failed to queue batch job',
          details: result.error,
        },
        { status: 500 }
      );
    }

    await AnalyticsDashboardCacheManager.invalidateOrgCache(orgId);

    return NextResponse.json({
      success: true,
      message: 'Batch job queued successfully',
      jobType,
      jobId: batchJob.id,
      orgId,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * GET /api/orgs/[orgId]/analytics/phase5/status
 * Check Python and Phase 5 environment status
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, 'admin');

    const pythonAvailable = await PythonOrchestrator.checkPythonEnvironment();
    const packages = await PythonOrchestrator.checkRequiredPackages();

    return NextResponse.json({
      status: 'ok',
      components: {
        python: {
          available: pythonAvailable,
          message: pythonAvailable
            ? 'Python environment configured'
            : 'Python not available',
        },
        packages: {
          available: packages.available,
          missing: packages.missing,
          message: packages.available
            ? 'All required packages installed'
            : `Missing packages: ${packages.missing.join(', ')}`,
        },
        phase5: {
          available: pythonAvailable && packages.available,
          components: [
            { name: 'Phase 5A: Forecasting', available: pythonAvailable },
            { name: 'Phase 5B: Explainability', available: pythonAvailable },
            { name: 'Phase 5C: Root Cause Analysis', available: pythonAvailable },
            { name: 'Phase 5D: Distributed Processing', available: pythonAvailable },
            { name: 'Phase 5E: Dashboard Cache', available: true },
          ],
        },
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
