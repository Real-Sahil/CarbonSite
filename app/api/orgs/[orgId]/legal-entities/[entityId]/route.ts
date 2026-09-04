export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { updateLegalEntitySchema } from "@/lib/validation/inventory";

type Params = { params: Promise<{ orgId: string; entityId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, entityId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const entity = await prisma.legalEntity.findFirst({
      where: { id: entityId, organizationId: orgId },
      include: {
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true, ownershipPercent: true } },
        facilities: { select: { id: true, name: true } },
      },
    });
    if (!entity) return apiError("NOT_FOUND", "Legal entity not found.", 404);

    return Response.json(entity);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, entityId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "sustainability_director");

    const existing = await prisma.legalEntity.findFirst({
      where: { id: entityId, organizationId: orgId },
    });
    if (!existing) return apiError("NOT_FOUND", "Legal entity not found.", 404);

    const body = updateLegalEntitySchema.parse(await req.json());

    if (body.parentId !== undefined && body.parentId !== null) {
      if (body.parentId === entityId) {
        return apiError("INVALID_PARENT", "An entity cannot be its own parent.", 422);
      }
      const parent = await prisma.legalEntity.findFirst({
        where: { id: body.parentId, organizationId: orgId },
        select: { id: true },
      });
      if (!parent) {
        return apiError("NOT_FOUND", "Parent legal entity not found in this organisation.", 404);
      }
      if (await createsCycle(entityId, body.parentId, orgId)) {
        return apiError(
          "INVALID_PARENT",
          "That parent would create a circular ownership chain.",
          422,
        );
      }
    }

    const acquiredOn = body.acquiredOn ?? existing.acquiredOn;
    const divestedOn = body.divestedOn ?? existing.divestedOn;
    if (acquiredOn && divestedOn && divestedOn < acquiredOn) {
      return apiError(
        "INVALID_RANGE",
        "Divestiture date cannot fall before the acquisition date.",
        422,
      );
    }

    const entity = await prisma.legalEntity.update({
      where: { id: entityId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.registrationNumber !== undefined && {
          registrationNumber: body.registrationNumber ?? null,
        }),
        ...(body.country !== undefined && { country: body.country ?? null }),
        ...(body.parentId !== undefined && { parentId: body.parentId ?? null }),
        ...(body.ownershipPercent !== undefined && { ownershipPercent: body.ownershipPercent }),
        ...(body.operationalControl !== undefined && {
          operationalControl: body.operationalControl,
        }),
        ...(body.financialControl !== undefined && { financialControl: body.financialControl }),
        ...(body.acquiredOn !== undefined && { acquiredOn: body.acquiredOn ?? null }),
        ...(body.divestedOn !== undefined && { divestedOn: body.divestedOn ?? null }),
        ...(body.notes !== undefined && { notes: body.notes ?? null }),
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "legal_entity.updated",
      resourceType: "LegalEntity",
      resourceId: entity.id,
      metadata: { changedFields: Object.keys(body) },
    });

    return Response.json(entity);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, entityId } = await params;
    const { session } = await requireOrgMember(orgId, "admin");

    const entity = await prisma.legalEntity.findFirst({
      where: { id: entityId, organizationId: orgId },
      include: { _count: { select: { children: true, facilities: true } } },
    });
    if (!entity) return apiError("NOT_FOUND", "Legal entity not found.", 404);

    if (entity._count.children > 0) {
      return apiError(
        "HAS_DEPENDENTS",
        "Reassign or remove the child entities before deleting this one.",
        409,
      );
    }
    if (entity._count.facilities > 0) {
      return apiError(
        "HAS_DEPENDENTS",
        "Reassign the facilities attached to this entity before deleting it.",
        409,
      );
    }

    await prisma.legalEntity.delete({ where: { id: entityId } });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "legal_entity.deleted",
      resourceType: "LegalEntity",
      resourceId: entityId,
      metadata: { name: entity.name },
    });

    return Response.json({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Walks up from the proposed parent to see whether it loops back to the entity. */
async function createsCycle(
  entityId: string,
  proposedParentId: string,
  orgId: string,
): Promise<boolean> {
  const seen = new Set<string>([entityId]);
  let cursor: string | null = proposedParentId;

  while (cursor) {
    if (seen.has(cursor)) return true;
    seen.add(cursor);

    const parent: { parentId: string | null } | null = await prisma.legalEntity.findFirst({
      where: { id: cursor, organizationId: orgId },
      select: { parentId: true },
    });
    cursor = parent?.parentId ?? null;
  }
  return false;
}
