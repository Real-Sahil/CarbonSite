export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { resolveRecalculationSchema } from "@/lib/validation/inventory";
import { applyRecalculation } from "@/lib/inventory/base-year";

type Params = { params: Promise<{ orgId: string; recalculationId: string }> };

/**
 * Approve or reject a base year recalculation.
 *
 * Approving rewrites the base year's current totals to the restated figures,
 * which moves every target and trend line measured against it. That is why it
 * is restricted to admins and sustainability directors and is always audited.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId, recalculationId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "sustainability_director");

    const recalc = await prisma.baseYearRecalculation.findFirst({
      where: { id: recalculationId, organizationId: orgId },
    });
    if (!recalc) return apiError("NOT_FOUND", "Recalculation not found.", 404);

    if (recalc.status === "approved" || recalc.status === "rejected") {
      return apiError("ALREADY_RESOLVED", "This recalculation has already been resolved.", 409);
    }
    if (!recalc.isSignificant) {
      return apiError(
        "NOT_SIGNIFICANT",
        "This assessment fell below the significance threshold, so the base year must not be restated. It is retained as evidence that the change was considered.",
        422,
      );
    }

    const body = resolveRecalculationSchema.parse(await req.json());

    if (body.decision === "reject") {
      const updated = await prisma.baseYearRecalculation.update({
        where: { id: recalc.id },
        data: {
          status: "rejected",
          approvedByUserId: session.user.id,
          approvedAt: new Date(),
          notes: body.notes ? `${recalc.notes ?? ""}\n\nRejected: ${body.notes}`.trim() : recalc.notes,
        },
      });

      await writeAuditLog({
        organizationId: orgId,
        actorUserId: session.user.id,
        action: "base_year.recalculation_rejected",
        resourceType: "BaseYearRecalculation",
        resourceId: recalc.id,
        metadata: { baseYearId: recalc.baseYearId, notes: body.notes ?? null },
      });

      return Response.json(updated);
    }

    const updated = await applyRecalculation({
      organizationId: orgId,
      recalculationId: recalc.id,
      approvedByUserId: session.user.id,
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "base_year.recalculation_approved",
      resourceType: "BaseYearRecalculation",
      resourceId: recalc.id,
      metadata: {
        baseYearId: recalc.baseYearId,
        previousTotalCo2e:
          recalc.previousTotalCo2e === null ? null : Number(recalc.previousTotalCo2e),
        restatedTotalCo2e:
          recalc.restatedTotalCo2e === null ? null : Number(recalc.restatedTotalCo2e),
        deltaPercent: recalc.deltaPercent === null ? null : Number(recalc.deltaPercent),
      },
    });

    return Response.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
