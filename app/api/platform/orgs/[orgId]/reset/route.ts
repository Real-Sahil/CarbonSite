export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePlatformMember } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";

type Params = { params: Promise<{ orgId: string }> };

// Clear all activity data for an org while preserving structure (org, members,
// periods, sites, contracts, facilities). Allows starting fresh.
export async function POST(_req: Request, { params }: Params) {
  try {
    await requirePlatformMember();
    const { orgId } = await params;

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true },
    });
    if (!org) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Organisation not found." }, { status: 404 });
    }

    // Step-by-step deletion in FK-safe order. FK cascades handle some children
    // automatically (e.g. ActivityRecordEvidence cascades on ActivityRecord).

    // 1. Leaf rows that depend on CalculationRun or ActivityRecord
    await prisma.emissionCalculation.deleteMany({ where: { organizationId: orgId } });
    await prisma.dashboardAggregate.deleteMany({ where: { organizationId: orgId } });

    // 2. Reports reference PublishedSnapshot; delete before snapshots
    await prisma.report.deleteMany({ where: { organizationId: orgId } });
    await prisma.publishedSnapshot.deleteMany({ where: { organizationId: orgId } });

    // 2b. ScenarioRun references CalculationRun and must go before it.
    // ScenarioDraft cascades on ScenarioRun delete, so this alone clears both.
    // (Explicit rather than relying on the FK's ON DELETE behavior, which is
    // being tightened from CASCADE to RESTRICT precisely so a reset can't
    // silently take scenario history down as an undocumented side effect.)
    await prisma.scenarioRun.deleteMany({ where: { organizationId: orgId } });

    // 3. CalculationRun (EmissionCalculations and ScenarioRuns already gone)
    await prisma.calculationRun.deleteMany({ where: { organizationId: orgId } });

    // 4. Null out FieldSubmission.activityRecordId before deleting ActivityRecords
    await prisma.fieldSubmission.updateMany({
      where: { organizationId: orgId, activityRecordId: { not: null } },
      data: { activityRecordId: null },
    });

    // 5. ActivityRecords (cascades ActivityRecordEvidence)
    await prisma.activityRecord.deleteMany({ where: { organizationId: orgId } });

    // 6. StagedActivityRecords before ImportBatches
    await prisma.stagedActivityRecord.deleteMany({
      where: { importBatch: { organizationId: orgId } },
    });
    await prisma.importBatch.deleteMany({ where: { organizationId: orgId } });

    // 7. Null out FieldSubmission self-reference before deleting all submissions
    await prisma.fieldSubmission.updateMany({
      where: { organizationId: orgId, resubmittedFromId: { not: null } },
      data: { resubmittedFromId: null },
    });
    // FieldSubmissionFile cascades on FieldSubmission delete
    await prisma.fieldSubmission.deleteMany({ where: { organizationId: orgId } });

    // 8. Comments and review tasks (polymorphic targets are gone anyway)
    await prisma.comment.deleteMany({ where: { organizationId: orgId } });
    await prisma.reviewTask.deleteMany({ where: { organizationId: orgId } });

    return NextResponse.json({ ok: true, orgId, orgName: org.name });
  } catch (err) {
    return handleRouteError(err);
  }
}
