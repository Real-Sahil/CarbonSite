export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError } from "@/lib/validation/api";
import { updateConsolidationApproachSchema } from "@/lib/validation/inventory";
import {
  resolveEffectiveShares,
  facilityConsolidationFactor,
  explainFacilityFactor,
  type ConsolidatableEntity,
} from "@/lib/inventory/consolidation";
import { createRecalculationForChange } from "@/lib/inventory/base-year";

type Params = { params: Promise<{ orgId: string }> };

/**
 * The organisational boundary as it stands: the declared consolidation
 * approach, every legal entity with its effective share, and every facility
 * with the factor that will be applied to its emissions and the reason why.
 *
 * This is the page an assurance provider opens first.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const [org, entities, facilities] = await Promise.all([
      prisma.organization.findUniqueOrThrow({
        where: { id: orgId },
        select: { consolidationApproach: true },
      }),
      prisma.legalEntity.findMany({
        where: { organizationId: orgId },
        orderBy: { name: "asc" },
      }),
      prisma.facility.findMany({
        where: { organizationId: orgId },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          country: true,
          siteType: true,
          floorAreaM2: true,
          headcount: true,
          legalEntityId: true,
          operationalControl: true,
          operationalFrom: true,
          operationalTo: true,
        },
      }),
    ]);

    const consolidatable: ConsolidatableEntity[] = entities.map((e) => ({
      id: e.id,
      parentId: e.parentId,
      ownershipPercent: Number(e.ownershipPercent),
      operationalControl: e.operationalControl,
      financialControl: e.financialControl,
      acquiredOn: e.acquiredOn,
      divestedOn: e.divestedOn,
    }));

    const effectiveShares = resolveEffectiveShares(org.consolidationApproach, consolidatable);
    const today = new Date();

    return Response.json({
      consolidationApproach: org.consolidationApproach,
      entities: entities.map((e) => ({
        id: e.id,
        name: e.name,
        parentId: e.parentId,
        country: e.country,
        ownershipPercent: Number(e.ownershipPercent),
        operationalControl: e.operationalControl,
        financialControl: e.financialControl,
        acquiredOn: e.acquiredOn,
        divestedOn: e.divestedOn,
        effectiveSharePercent: (effectiveShares.get(e.id) ?? 0) * 100,
      })),
      facilities: facilities.map((f) => {
        const facilityInput = {
          id: f.id,
          legalEntityId: f.legalEntityId,
          operationalControl: f.operationalControl,
          operationalFrom: f.operationalFrom,
          operationalTo: f.operationalTo,
        };
        const args = {
          approach: org.consolidationApproach,
          facility: facilityInput,
          entities: consolidatable,
          effectiveShares,
          activityDate: today,
        };
        return {
          id: f.id,
          name: f.name,
          country: f.country,
          siteType: f.siteType,
          floorAreaM2: f.floorAreaM2 === null ? null : Number(f.floorAreaM2),
          headcount: f.headcount,
          legalEntityId: f.legalEntityId,
          operationalControl: f.operationalControl,
          operationalFrom: f.operationalFrom,
          operationalTo: f.operationalTo,
          consolidationFactorPercent: facilityConsolidationFactor(args) * 100,
          rationale: explainFacilityFactor(args),
        };
      }),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

/**
 * Change the consolidation approach.
 *
 * This is a boundary change under GHG Protocol Chapter 5, so it records a
 * structural change and assesses it against the active base year in the same
 * request. The caller cannot opt out of that: the whole point is that a
 * boundary change is never silent.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "sustainability_director");

    const body = updateConsolidationApproachSchema.parse(await req.json());

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { consolidationApproach: true },
    });

    if (org.consolidationApproach === body.consolidationApproach) {
      return Response.json({
        consolidationApproach: org.consolidationApproach,
        structuralChange: null,
        recalculation: null,
        message: "Consolidation approach unchanged.",
      });
    }

    const previous = org.consolidationApproach;

    const { updated, change } = await prisma.$transaction(async (tx) => {
      const updated = await tx.organization.update({
        where: { id: orgId },
        data: { consolidationApproach: body.consolidationApproach },
        select: { consolidationApproach: true },
      });

      const change = await tx.structuralChange.create({
        data: {
          organizationId: orgId,
          type: "boundary_change",
          effectiveDate: new Date(),
          description: `Consolidation approach changed from ${previous} to ${body.consolidationApproach}.`,
          notes: body.rationale,
          createdByUserId: session.user.id,
        },
      });

      return { updated, change };
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "consolidation_approach.changed",
      resourceType: "Organization",
      resourceId: orgId,
      metadata: {
        from: previous,
        to: updated.consolidationApproach,
        structuralChangeId: change.id,
        rationale: body.rationale,
      },
    });

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
          isSignificant: recalculation.isSignificant,
          status: recalculation.status,
        },
      });
    }

    return Response.json({
      consolidationApproach: updated.consolidationApproach,
      structuralChange: change,
      recalculation: recalculation
        ? {
            id: recalculation.id,
            status: recalculation.status,
            isSignificant: recalculation.isSignificant,
            deltaPercent:
              recalculation.deltaPercent === null ? null : Number(recalculation.deltaPercent),
          }
        : null,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
