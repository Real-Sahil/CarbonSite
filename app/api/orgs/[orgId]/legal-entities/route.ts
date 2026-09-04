export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createLegalEntitySchema } from "@/lib/validation/inventory";
import { resolveEffectiveShares } from "@/lib/inventory/consolidation";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const [org, entities] = await Promise.all([
      prisma.organization.findUniqueOrThrow({
        where: { id: orgId },
        select: { consolidationApproach: true },
      }),
      prisma.legalEntity.findMany({
        where: { organizationId: orgId },
        orderBy: [{ parentId: "asc" }, { name: "asc" }],
        include: { _count: { select: { facilities: true, children: true } } },
      }),
    ]);

    const shares = resolveEffectiveShares(
      org.consolidationApproach,
      entities.map((e) => ({
        id: e.id,
        parentId: e.parentId,
        ownershipPercent: Number(e.ownershipPercent),
        operationalControl: e.operationalControl,
        financialControl: e.financialControl,
        acquiredOn: e.acquiredOn,
        divestedOn: e.divestedOn,
      })),
    );

    return Response.json({
      consolidationApproach: org.consolidationApproach,
      data: entities.map((e) => ({
        ...e,
        ownershipPercent: Number(e.ownershipPercent),
        // The share actually applied to this entity's emissions after walking
        // the ownership chain, expressed 0-100.
        effectiveSharePercent: (shares.get(e.id) ?? 0) * 100,
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
      key: rateLimitKey(orgId, "legal-entities", session.user.id),
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = createLegalEntitySchema.parse(await req.json());

    if (body.parentId) {
      const parent = await prisma.legalEntity.findFirst({
        where: { id: body.parentId, organizationId: orgId },
        select: { id: true },
      });
      if (!parent) {
        return apiError("NOT_FOUND", "Parent legal entity not found in this organisation.", 404);
      }
    }

    if (body.acquiredOn && body.divestedOn && body.divestedOn < body.acquiredOn) {
      return apiError(
        "INVALID_RANGE",
        "Divestiture date cannot fall before the acquisition date.",
        422,
      );
    }

    const entity = await prisma.legalEntity.create({
      data: {
        organizationId: orgId,
        name: body.name,
        registrationNumber: body.registrationNumber ?? null,
        country: body.country ?? null,
        parentId: body.parentId ?? null,
        ownershipPercent: body.ownershipPercent,
        operationalControl: body.operationalControl,
        financialControl: body.financialControl,
        acquiredOn: body.acquiredOn ?? null,
        divestedOn: body.divestedOn ?? null,
        notes: body.notes ?? null,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "legal_entity.created",
      resourceType: "LegalEntity",
      resourceId: entity.id,
      metadata: {
        name: entity.name,
        ownershipPercent: Number(entity.ownershipPercent),
        parentId: entity.parentId,
      },
    });

    return Response.json(entity, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
