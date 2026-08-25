import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import {
  getFailedJobsForOrg,
  getFailedJobStats,
  recordFailedJob,
} from "@/lib/jobs/failed-job-manager";
import { z } from "zod";

const querySchema = z.object({
  status: z.enum(["failed", "retrying", "abandoned"]).optional(),
  type: z.enum(["import", "calculation", "report", "notification", "xero-sync"]).optional(),
});

/**
 * GET /api/orgs/[orgId]/jobs
 * List failed jobs for the organization with optional filtering.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.admin);

    const query = querySchema.parse({
      status: request.nextUrl.searchParams.get("status") ?? undefined,
      type: request.nextUrl.searchParams.get("type") ?? undefined,
    });

    const jobs = getFailedJobsForOrg(orgId, {
      status: query.status,
      jobType: query.type,
    });

    const stats = getFailedJobStats(orgId);

    return NextResponse.json({
      jobs: jobs.map((job) => ({
        id: job.id,
        jobType: job.jobType,
        resourceId: job.resourceId,
        error: job.error,
        retryCount: job.retryCount,
        maxRetries: job.maxRetries,
        status: job.status,
        failedAt: job.failedAt,
        lastRetryAt: job.lastRetryAt,
        nextRetryAt: job.nextRetryAt,
      })),
      stats,
      pagination: {
        total: jobs.length,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
