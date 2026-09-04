export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createStructuralChangeSchema } from "@/lib/validation/inventory";
import { createRecalculationForChange, triggersRecalculation } from "@/lib/inventory/base-year";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const changes = await prisma.structuralChange.findMany({
      where: { organizationId: orgId },
      orderBy: { effectiveDate: "desc" },
      include: {
        legalEntity: { select: { id: true, name: true } },
        createdBy: { select: { name: true, email: true } },
        recalculations: {
          select: {
            id: true,
            status: true,
            deltaPercent: true,
            isSignificant: true,
            baseYearId: true,
          },
        },
      },
    });

    return Response.json({
      data: changes.map((c) => ({
        ...c,
        estimatedImpactCo2e:
          c.estimatedImpactCo2e === null ? null : Number(c.estimatedImpactCo2e),
        triggersRecalculation: triggersRecalculation(c.type),
        recalculations: c.recalculations.map((r) => ({
          ...r,
          deltaPercent: r.deltaPercent === null ? null : Number(r.deltaPercent),
        })),
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
      key: rateLimitKey(orgId, "structural-changes", session.user.id),
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = createStructuralChangeSchema.parse(await req.json());

    if (body.legalEntityId) {
      const entity = await prisma.legalEntity.findFirst({
        where: { id: body.legalEntityId, organizationId: orgId },
        select: { id: true },
      });
      if (!entity) {
        return apiError("NOT_FOUND", "Legal entity not found in this organisation.", 404);
      }
    }

    const change = await prisma.structuralChange.create({
      data: {
        organizationId: orgId,
        type: body.type,
        effectiveDate: body.effectiveDate,
        description: body.description,
        legalEntityId: body.legalEntityId ?? null,
        estimatedImpactCo2e: body.estimatedImpactCo2e ?? null,
        notes: body.notes ?? null,
        createdByUserId: session.user.id,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "structural_change.recorded",
      resourceType: "StructuralChange",
      resourceId: change.id,
      metadata: {
        type: change.type,
        effectiveDate: change.effectiveDate.toISOString(),
        legalEntityId: change.legalEntityId,
      },
    });

    // Assess the change against the active base year straight away. Returns
    // null when there is no active base year or the change type does not
    // oblige a recalculation, both of which are ordinary outcomes.
    const recalculation = await createRecalculationForChange({
      organizationId: orgId,
      structuralChangeId: change.id,
      createdByUserId: session.user.id,
    });

    if (recalculation) {
      await writeAuditLog({
        organizationId: orgId,
        actorUserId: session.user.id,
        action: "base_year.recalculation_assessed",
        resourceType: "BaseYearRecalculation",
        resourceId: recalculation.id,
        metadata: {
          structuralChangeId: change.id,
          deltaPercent:
            recalculation.deltaPercent === null ? null : Number(recalculation.deltaPercent),
          isSignificant: recalculation.isSignificant,
          status: recalculation.status,
        },
      });
    }

    return Response.json(
      {
        ...change,
        estimatedImpactCo2e:
          change.estimatedImpactCo2e === null ? null : Number(change.estimatedImpactCo2e),
        recalculation: recalculation
          ? {
              ...recalculation,
              deltaPercent:
                recalculation.deltaPercent === null
                  ? null
                  : Number(recalculation.deltaPercent),
              previousTotalCo2e:
                recalculation.previousTotalCo2e === null
                  ? null
                  : Number(recalculation.previousTotalCo2e),
              restatedTotalCo2e:
                recalculation.restatedTotalCo2e === null
                  ? null
                  : Number(recalculation.restatedTotalCo2e),
            }
          : null,
      },
      { status: 201 },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
