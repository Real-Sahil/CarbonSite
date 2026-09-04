export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createRestatementSchema } from "@/lib/validation/inventory";
import { computePeriodTotals, deltaPercent } from "@/lib/inventory/base-year";

type Params = { params: Promise<{ orgId: string }> };

/** Frameworks expect restatements above this share of the total to be disclosed. */
const MATERIALITY_THRESHOLD_PERCENT = 5;

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const restatements = await prisma.restatement.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      include: {
        supersededSnapshot: {
          select: {
            id: true,
            version: true,
            publishedAt: true,
            reportingPeriod: { select: { label: true } },
          },
        },
        replacementSnapshot: {
          select: {
            id: true,
            version: true,
            publishedAt: true,
            reportingPeriod: { select: { label: true } },
          },
        },
        createdBy: { select: { name: true, email: true } },
      },
    });

    return Response.json({
      data: restatements.map((r) => ({
        ...r,
        previousTotalCo2e: r.previousTotalCo2e === null ? null : Number(r.previousTotalCo2e),
        restatedTotalCo2e: r.restatedTotalCo2e === null ? null : Number(r.restatedTotalCo2e),
        deltaPercent: r.deltaPercent === null ? null : Number(r.deltaPercent),
      })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "sustainability_director");

    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "restatements", session.user.id),
      limit: 20,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = createRestatementSchema.parse(await req.json());

    const superseded = await prisma.publishedSnapshot.findFirst({
      where: { id: body.supersededSnapshotId, organizationId: orgId },
      select: { id: true, reportingPeriodId: true },
    });
    if (!superseded) {
      return apiError("NOT_FOUND", "Superseded snapshot not found in this organisation.", 404);
    }

    let replacementPeriodId: string | null = null;
    if (body.replacementSnapshotId) {
      const replacement = await prisma.publishedSnapshot.findFirst({
        where: { id: body.replacementSnapshotId, organizationId: orgId },
        select: { id: true, reportingPeriodId: true },
      });
      if (!replacement) {
        return apiError("NOT_FOUND", "Replacement snapshot not found in this organisation.", 404);
      }
      if (replacement.reportingPeriodId !== superseded.reportingPeriodId) {
        return apiError(
          "PERIOD_MISMATCH",
          "A restatement must replace a snapshot covering the same reporting period.",
          422,
        );
      }
      replacementPeriodId = replacement.reportingPeriodId;
    }

    // Derive the totals when the caller does not supply them, so the magnitude
    // of a restatement is never left to hand-typed figures.
    const previousTotal =
      body.previousTotalCo2e ??
      (await snapshotTotal(orgId, superseded.id, superseded.reportingPeriodId));
    const restatedTotal =
      body.restatedTotalCo2e ??
      (replacementPeriodId
        ? (await computePeriodTotals(orgId, replacementPeriodId)).total
        : previousTotal);

    const delta = deltaPercent(previousTotal, restatedTotal);

    const restatement = await prisma.restatement.create({
      data: {
        organizationId: orgId,
        supersededSnapshotId: superseded.id,
        replacementSnapshotId: body.replacementSnapshotId ?? null,
        reason: body.reason,
        description: body.description,
        previousTotalCo2e: previousTotal,
        restatedTotalCo2e: restatedTotal,
        deltaPercent: delta,
        isMaterial: Math.abs(delta) >= MATERIALITY_THRESHOLD_PERCENT,
        createdByUserId: session.user.id,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "restatement.recorded",
      resourceType: "Restatement",
      resourceId: restatement.id,
      metadata: {
        supersededSnapshotId: superseded.id,
        reason: restatement.reason,
        deltaPercent: delta,
        isMaterial: restatement.isMaterial,
      },
    });

    return Response.json(
      {
        ...restatement,
        previousTotalCo2e: Number(restatement.previousTotalCo2e),
        restatedTotalCo2e: Number(restatement.restatedTotalCo2e),
        deltaPercent: Number(restatement.deltaPercent),
      },
      { status: 201 },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Total tCO2e carried by one snapshot, from its own aggregate rows. */
async function snapshotTotal(
  organizationId: string,
  snapshotId: string,
  reportingPeriodId: string,
): Promise<number> {
  const rows = await prisma.dashboardAggregate.aggregate({
    where: {
      organizationId,
      snapshotId,
      reportingPeriodId,
      emissionCategoryId: { not: null },
      facilityId: null,
      businessUnitId: null,
    },
    _sum: { totalCo2e: true },
  });
  return Number(rows._sum.totalCo2e ?? 0);
}
