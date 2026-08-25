export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { apiError, handleRouteError } from "@/lib/validation/api";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; runId: string }> },
) {
  try {
    const { orgId, runId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor", "reviewer");
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "snapshot-publish", session.user.id),
      limit: 10,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const run = await prisma.calculationRun.findFirst({
      where: { id: runId, organizationId: orgId },
      select: { id: true, reportingPeriodId: true, status: true },
    });

    if (!run) {
      return apiError("NOT_FOUND", "Calculation run was not found.", 404);
    }
    if (run.status !== "succeeded") {
      return apiError("RUN_NOT_READY", "Only succeeded calculation runs can be published.", 422);
    }

    const latest = await prisma.publishedSnapshot.findFirst({
      where: { organizationId: orgId, reportingPeriodId: run.reportingPeriodId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const version = (latest?.version ?? 0) + 1;

    const snapshot = await prisma.$transaction(async (tx) => {
      const created = await tx.publishedSnapshot.create({
        data: {
          organizationId: orgId,
          reportingPeriodId: run.reportingPeriodId,
          calculationRunId: run.id,
          publishedByUserId: session.user.id,
          version,
        },
      });

      const aggregates = await tx.dashboardAggregate.findMany({
        where: {
          organizationId: orgId,
          reportingPeriodId: run.reportingPeriodId,
          snapshotId: null,
        },
      });

      if (aggregates.length) {
        await tx.dashboardAggregate.createMany({
          data: aggregates.map((row) => ({
            organizationId: row.organizationId,
            reportingPeriodId: row.reportingPeriodId,
            snapshotId: created.id,
            scope: row.scope,
            emissionCategoryId: row.emissionCategoryId,
            facilityId: row.facilityId,
            businessUnitId: row.businessUnitId,
            totalCo2e: row.totalCo2e,
            recordCount: row.recordCount,
          })),
        });
      }

      return created;
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "snapshot.published",
      resourceType: "published_snapshot",
      resourceId: snapshot.id,
      metadata: {
        calculationRunId: run.id,
        reportingPeriodId: run.reportingPeriodId,
        version,
      },
    });

    return NextResponse.json(snapshot, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
