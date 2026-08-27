import { NextRequest, NextResponse } from 'next/server';
import { requireOrgMember } from '@/lib/auth/session';
import { handleRouteError } from '@/lib/validation/api';
import { detectOutliers, detectTrendChanges } from '@/lib/analytics/anomaly-detection';
import { z } from 'zod';

const querySchema = z.object({
  reportingPeriodId: z.string().cuid().optional(),
  severity: z.enum(['low', 'medium', 'high']).optional(),
  limit: z.string().default('50').transform(Number),
  offset: z.string().default('0').transform(Number),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, 'viewer', 'reviewer', 'editor', 'admin', 'auditor');

    const query = querySchema.parse({
      reportingPeriodId: req.nextUrl.searchParams.get('reportingPeriodId'),
      severity: req.nextUrl.searchParams.get('severity'),
      limit: req.nextUrl.searchParams.get('limit'),
      offset: req.nextUrl.searchParams.get('offset'),
    });

    // Detect both outliers and trend changes in parallel
    const [outliers, trendChanges] = await Promise.all([
      detectOutliers(orgId, query.reportingPeriodId),
      detectTrendChanges(orgId),
    ]);

    // Combine and filter by severity
    let anomalies = [...outliers, ...trendChanges];

    if (query.severity) {
      anomalies = anomalies.filter(a => a.severity === query.severity);
    }

    // Sort by severity (high → medium → low) then by deviation
    const severityOrder = { high: 0, medium: 1, low: 2 };
    anomalies.sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      return severityDiff !== 0 ? severityDiff : b.deviation - a.deviation;
    });

    // Pagination
    const total = anomalies.length;
    const paginatedAnomalies = anomalies.slice(query.offset, query.offset + query.limit);

    return NextResponse.json({
      success: true,
      data: paginatedAnomalies,
      pagination: {
        total,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + query.limit < total,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
