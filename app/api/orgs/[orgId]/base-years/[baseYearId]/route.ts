export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { updateBaseYearSchema } from "@/lib/validation/inventory";

type Params = { params: Promise<{ orgId: string; baseYearId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, baseYearId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const baseYear = await prisma.baseYear.findFirst({
      where: { id: baseYearId, organizationId: orgId },
      include: {
        reportingPeriod: { select: { id: true, label: true, startDate: true, endDate: true } },
        createdBy: { select: { name: true, email: true } },
        recalculations: {
          orderBy: { createdAt: "desc" },
          include: {
            structuralChange: {
              select: { id: true, type: true, effectiveDate: true, description: true },
            },
            approvedBy: { select: { name: true, email: true } },
          },
        },
      },
    });
    if (!baseYear) return apiError("NOT_FOUND", "Base year not found.", 404);

    return Response.json({
      ...baseYear,
      significanceThresholdPercent: Number(baseYear.significanceThresholdPercent),
      recalculations: baseYear.recalculations.map((r) => ({
        ...r,
        deltaPercent: r.deltaPercent === null ? null : Number(r.deltaPercent),
        previousTotalCo2e: r.previousTotalCo2e === null ? null : Number(r.previousTotalCo2e),
        restatedTotalCo2e: r.restatedTotalCo2e === null ? null : Number(r.restatedTotalCo2e),
      })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, baseYearId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "sustainability_director");

    const existing = await prisma.baseYear.findFirst({
      where: { id: baseYearId, organizationId: orgId },
    });
    if (!existing) return apiError("NOT_FOUND", "Base year not found.", 404);

    const body = updateBaseYearSchema.parse(await req.json());

    // A locked base year is the published reference point for every target and
    // trend. Its threshold and period may not be edited in place; a correction
    // goes through a structural change and a recalculation instead.
    if (existing.lockedAt && body.significanceThresholdPercent !== undefined) {
      return apiError(
        "LOCKED",
        "This base year is locked. Record a structural change to alter it.",
        409,
      );
    }

    const activating = body.status === "active" && existing.status !== "active";

    const baseYear = await prisma.$transaction(async (tx) => {
      // Only one active base year per organisation. Supersede the incumbent in
      // the same transaction as the partial unique index would otherwise reject
      // the write.
      if (activating) {
        await tx.baseYear.updateMany({
          where: { organizationId: orgId, status: "active", id: { not: baseYearId } },
          data: { status: "superseded" },
        });
      }

      return tx.baseYear.update({
        where: { id: baseYearId },
        data: {
          ...(body.label !== undefined && { label: body.label }),
          ...(body.rationale !== undefined && { rationale: body.rationale ?? null }),
          ...(body.significanceThresholdPercent !== undefined && {
            significanceThresholdPercent: body.significanceThresholdPercent,
          }),
          ...(body.status !== undefined && { status: body.status }),
          ...(activating && { lockedAt: existing.lockedAt ?? new Date() }),
        },
      });
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: activating ? "base_year.activated" : "base_year.locked",
      resourceType: "BaseYear",
      resourceId: baseYear.id,
      metadata: { changedFields: Object.keys(body), status: baseYear.status },
    });

    return Response.json(baseYear);
  } catch (err) {
    return handleRouteError(err);
  }
}
