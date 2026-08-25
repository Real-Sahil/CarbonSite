// GET: Retrieve draft calculations for a scenario run

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; runId: string; scenarioId: string }> },
) {
  try {
    const { orgId, scenarioId } = await params;
    await requireOrgMember(orgId as string, "viewer", "editor", "reviewer", "admin");

    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor");
    const take = 50;

    // Verify scenario belongs to this org
    const scenario = await prisma.scenarioRun.findFirst({
      where: { id: scenarioId as string, organizationId: orgId as string },
    });
    if (!scenario) {
      return apiError("scenario_not_found", "Scenario not found", 404);
    }

    // Check if expired
    if (scenario.expiresAt < new Date()) {
      return apiError("scenario_expired", "This scenario has expired", 410);
    }

    // Fetch drafts with cursor pagination
    const [drafts, total] = await Promise.all([
      prisma.scenarioDraft.findMany({
        where: { scenarioRunId: scenarioId },
        select: {
          id: true,
          activityRecordId: true,
          originalAmount: true,
          originalUnit: true,
          normalizedAmount: true,
          normalizedUnit: true,
          totalCo2e: true,
          dataQualityScore: true,
          confidenceIntervalLower: true,
          confidenceIntervalUpper: true,
          selectionReason: true,
          formula: true,
          warnings: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      prisma.scenarioDraft.count({ where: { scenarioRunId: scenarioId } }),
    ]);

    const hasMore = drafts.length > take;
    const data = hasMore ? drafts.slice(0, take) : drafts;

    return NextResponse.json({
      data,
      nextCursor: hasMore ? data[data.length - 1].id : null,
      total,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
