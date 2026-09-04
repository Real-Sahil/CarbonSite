export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { parseDataOrigin } from "@/lib/inventory/provenance";

type Params = { params: Promise<{ orgId: string; importId: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, importId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");

    const batch = await prisma.importBatch.findUnique({
      where: { id: importId },
      select: {
        id: true,
        organizationId: true,
        reportingPeriodId: true,
        state: true,
        templateKey: true,
      },
    });

    if (!batch || batch.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Import batch not found.", 404);
    }
    if (batch.state !== "ready_to_commit") {
      return apiError(
        "CONFLICT",
        `Batch cannot be committed in state '${batch.state}'. It must be 'ready_to_commit'.`,
        409,
      );
    }

    const stagedRecords = await prisma.stagedActivityRecord.findMany({
      where: { importBatchId: importId, status: "ready" },
      select: { id: true, data: true },
    });

    if (stagedRecords.length === 0) {
      return apiError("CONFLICT", "No ready staged records to commit.", 409);
    }

    // Commit in a transaction — create ActivityRecords then mark batch committed
    const committed = await prisma.$transaction(async (tx) => {
      const records = await Promise.all(
        stagedRecords.map((sr) => {
          const d = sr.data as Record<string, unknown>;
          return tx.activityRecord.create({
            data: {
              organizationId: orgId,
              reportingPeriodId: batch.reportingPeriodId,
              emissionCategoryId: d.emissionCategoryId as string,
              amount: d.amount as number,
              unit: d.unit as string,
              activityDate: d.activityDate ? new Date(d.activityDate as string) : undefined,
              startDate: d.startDate ? new Date(d.startDate as string) : undefined,
              endDate: d.endDate ? new Date(d.endDate as string) : undefined,
              sourceDescription: (d.sourceDescription as string | undefined) ?? undefined,
              facilityId: (d.facilityId as string | undefined) ?? undefined,
              businessUnitId: (d.businessUnitId as string | undefined) ?? undefined,
              supplierName: (d.supplierName as string | undefined) ?? undefined,
              country: (d.country as string | undefined) ?? undefined,
              region: (d.region as string | undefined) ?? undefined,
              fuelType: (d.fuelType as string | undefined) ?? undefined,
              refrigerantType: (d.refrigerantType as string | undefined) ?? undefined,
              transportMode: (d.transportMode as string | undefined) ?? undefined,
              assumptionNotes: (d.assumptionNotes as string | undefined) ?? undefined,
              // Provenance is normalised by the validator at staging time, so
              // by here it is always a valid tier. The fallback covers rows
              // staged before this column existed.
              dataOrigin: parseDataOrigin(d.dataOrigin) ?? "estimated",
              dataOriginNote: (d.dataOriginNote as string | undefined) ?? undefined,
              importBatchId: importId,
              // Staged validation + the explicit commit action ARE the review
              // gate for imports (admin/editor only, no partial commits) —
              // committed records enter calculations immediately, consistent
              // with reviewed field submissions. Individual records can still
              // be rejected afterwards on the records page.
              reviewStatus: "approved",
              evidenceStatus: "missing",
              createdByUserId: session.user.id,
            },
            select: { id: true },
          });
        }),
      );

      await tx.importBatch.update({
        where: { id: importId },
        data: { state: "committed" },
      });

      return records;
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "import.committed",
      resourceType: "import_batch",
      resourceId: importId,
      metadata: { committedCount: committed.length },
    });

    return NextResponse.json({ committedCount: committed.length });
  } catch (err) {
    return handleRouteError(err);
  }
}
