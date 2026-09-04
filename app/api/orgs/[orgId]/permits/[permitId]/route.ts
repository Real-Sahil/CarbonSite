export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { updatePermitSchema, createPermitConditionSchema } from "@/lib/validation/environment";
import { permitUrgency, daysUntil } from "@/lib/environment/permits";

type Params = { params: Promise<{ orgId: string; permitId: string }> };

const MANAGE_ROLES = ["admin", "sustainability_director", "operations_manager", "editor"] as const;

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, permitId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const permit = await prisma.environmentalPermit.findFirst({
      where: { id: permitId, organizationId: orgId },
      include: {
        facility: { select: { id: true, name: true } },
        site: { select: { id: true, name: true } },
        owner: { select: { name: true, email: true } },
        conditions: { orderBy: { reference: "asc" } },
        incidents: {
          orderBy: { occurredAt: "desc" },
          take: 20,
          select: {
            id: true,
            reference: true,
            type: true,
            severity: true,
            status: true,
            occurredAt: true,
          },
        },
      },
    });
    if (!permit) return apiError("NOT_FOUND", "Permit not found.", 404);

    const now = new Date();
    return Response.json({
      ...permit,
      urgency: permitUrgency(permit, now),
      daysToExpiry: permit.expiresOn ? daysUntil(permit.expiresOn, now) : null,
      conditions: permit.conditions.map((c) => ({
        ...c,
        limitValue: c.limitValue === null ? null : Number(c.limitValue),
      })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, permitId } = await params;
    const { session } = await requireOrgMember(orgId, ...MANAGE_ROLES);

    const existing = await prisma.environmentalPermit.findFirst({
      where: { id: permitId, organizationId: orgId },
    });
    if (!existing) return apiError("NOT_FOUND", "Permit not found.", 404);

    const body = updatePermitSchema.parse(await req.json());

    if (body.reference && body.reference !== existing.reference) {
      const duplicate = await prisma.environmentalPermit.findFirst({
        where: { organizationId: orgId, reference: body.reference, id: { not: permitId } },
        select: { id: true },
      });
      if (duplicate) {
        return apiError(
          "DUPLICATE_REFERENCE",
          "A permit with that reference already exists in this organisation.",
          409,
        );
      }
    }

    const effectiveFrom = body.effectiveFrom ?? existing.effectiveFrom;
    const expiresOn = body.expiresOn ?? existing.expiresOn;
    if (effectiveFrom && expiresOn && expiresOn < effectiveFrom) {
      return apiError("INVALID_RANGE", "Expiry cannot fall before the effective date.", 422);
    }

    const permit = await prisma.environmentalPermit.update({
      where: { id: permitId },
      data: {
        ...(body.type !== undefined && { type: body.type }),
        ...(body.reference !== undefined && { reference: body.reference }),
        ...(body.issuingAuthority !== undefined && { issuingAuthority: body.issuingAuthority }),
        ...(body.title !== undefined && { title: body.title }),
        ...(body.description !== undefined && { description: body.description ?? null }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.facilityId !== undefined && { facilityId: body.facilityId ?? null }),
        ...(body.siteId !== undefined && { siteId: body.siteId ?? null }),
        ...(body.issuedOn !== undefined && { issuedOn: body.issuedOn ?? null }),
        ...(body.effectiveFrom !== undefined && { effectiveFrom: body.effectiveFrom ?? null }),
        ...(body.expiresOn !== undefined && { expiresOn: body.expiresOn ?? null }),
        ...(body.renewalNoticeDays !== undefined && {
          renewalNoticeDays: body.renewalNoticeDays,
        }),
        ...(body.ownerUserId !== undefined && { ownerUserId: body.ownerUserId ?? null }),
        ...(body.notes !== undefined && { notes: body.notes ?? null }),
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "permit.updated",
      resourceType: "EnvironmentalPermit",
      resourceId: permit.id,
      metadata: { reference: permit.reference, changedFields: Object.keys(body) },
    });

    return Response.json(permit);
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Adds a numbered condition to the permit. Compliance is tracked per condition. */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId, permitId } = await params;
    const { session } = await requireOrgMember(orgId, ...MANAGE_ROLES);

    const permit = await prisma.environmentalPermit.findFirst({
      where: { id: permitId, organizationId: orgId },
      select: { id: true, reference: true },
    });
    if (!permit) return apiError("NOT_FOUND", "Permit not found.", 404);

    const body = createPermitConditionSchema.parse(await req.json());

    const condition = await prisma.permitCondition.create({
      data: {
        organizationId: orgId,
        permitId,
        reference: body.reference,
        description: body.description,
        limitValue: body.limitValue ?? null,
        limitUnit: body.limitUnit ?? null,
        monitoringFrequency: body.monitoringFrequency ?? null,
        complianceStatus: body.complianceStatus,
        lastAssessedOn: body.lastAssessedOn ?? null,
        nextDueOn: body.nextDueOn ?? null,
        notes: body.notes ?? null,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "permit.condition_created",
      resourceType: "PermitCondition",
      resourceId: condition.id,
      metadata: { permitReference: permit.reference, conditionReference: condition.reference },
    });

    return Response.json(
      { ...condition, limitValue: condition.limitValue === null ? null : Number(condition.limitValue) },
      { status: 201 },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, permitId } = await params;
    const { session } = await requireOrgMember(orgId, "admin");

    const permit = await prisma.environmentalPermit.findFirst({
      where: { id: permitId, organizationId: orgId },
      include: { _count: { select: { incidents: true } } },
    });
    if (!permit) return apiError("NOT_FOUND", "Permit not found.", 404);

    // A permit with incidents against it is part of the compliance record.
    // Surrendering or revoking it keeps that history; deleting would erase it.
    if (permit._count.incidents > 0) {
      return apiError(
        "HAS_DEPENDENTS",
        "This permit has incidents recorded against it and forms part of the compliance record. Set its status to surrendered or revoked instead of deleting it.",
        409,
      );
    }

    await prisma.environmentalPermit.delete({ where: { id: permitId } });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "permit.deleted",
      resourceType: "EnvironmentalPermit",
      resourceId: permitId,
      metadata: { reference: permit.reference },
    });

    return Response.json({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
