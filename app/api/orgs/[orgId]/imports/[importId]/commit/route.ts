export const dynamic = "force-dynamic";
// Committing writes every staged row of the batch in one transaction (below).
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { parseDataOrigin } from "@/lib/inventory/provenance";
import { requireActiveBilling, requireWithinUsageLimit } from "@/lib/billing/limits";
import { recordUsage } from "@/lib/billing/usage";

type Params = { params: Promise<{ orgId: string; importId: string }> };

/** Rows per createMany inside the commit transaction (about 25 columns each, under Postgres's bind limit). */
const COMMIT_INSERT_CHUNK = 500;
/** Interactive transaction timeout. Prisma's default 5 s is far too short for a 25k-row import. */
const COMMIT_TX_TIMEOUT_MS = 50_000;

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, importId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);

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

    const billingBlock = await requireActiveBilling(orgId);
    if (billingBlock) return billingBlock;
    const usageBlock = await requireWithinUsageLimit(orgId, "import.committed");
    if (usageBlock) return usageBlock;

    // All-or-nothing: the batch flips to committed and every record is written in
    // one transaction, so any failure leaves the batch ready_to_commit with nothing
    // written. The flip comes first and is conditional, so a second commit of the
    // same batch (a double submit) finds no row to flip and writes nothing.
    const committedCount = await prisma.$transaction(
      async (tx) => {
        const flipped = await tx.importBatch.updateMany({
          where: { id: importId, organizationId: orgId, state: "ready_to_commit" },
          data: { state: "committed" },
        });
        if (flipped.count !== 1) return null;

        let count = 0;
        for (let i = 0; i < stagedRecords.length; i += COMMIT_INSERT_CHUNK) {
          const rows = stagedRecords.slice(i, i + COMMIT_INSERT_CHUNK).map((sr) => {
            const d = sr.data as Record<string, unknown>;
            return {
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
              industryCode: (d.industryCode as string | undefined) ?? undefined,
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
              reviewStatus: "approved" as const,
              evidenceStatus: "missing" as const,
              createdByUserId: session.user.id,
            };
          });
          const result = await tx.activityRecord.createMany({ data: rows });
          count += result.count;
        }
        return count;
      },
      { timeout: COMMIT_TX_TIMEOUT_MS, maxWait: 5_000 },
    );

    if (committedCount === null) {
      return apiError("CONFLICT", "This batch is no longer ready to commit. Reload the import.", 409);
    }

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "import.committed",
      resourceType: "import_batch",
      resourceId: importId,
      metadata: { committedCount },
    });

    await recordUsage({ organizationId: orgId, eventType: "import.committed" });

    return NextResponse.json({ committedCount });
  } catch (err) {
    return handleRouteError(err);
  }
}
