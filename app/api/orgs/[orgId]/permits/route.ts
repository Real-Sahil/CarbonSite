export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createPermitSchema } from "@/lib/validation/environment";
import {
  permitUrgency,
  permitSortRank,
  summarisePermitRegister,
  daysUntil,
} from "@/lib/environment/permits";

type Params = { params: Promise<{ orgId: string }> };

const MANAGE_ROLES = ["admin", "sustainability_director", "operations_manager", "editor"] as const;

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const permits = await prisma.environmentalPermit.findMany({
      where: { organizationId: orgId },
      include: {
        facility: { select: { id: true, name: true } },
        site: { select: { id: true, name: true } },
        owner: { select: { name: true, email: true } },
        conditions: {
          orderBy: { reference: "asc" },
          select: {
            id: true,
            reference: true,
            description: true,
            limitValue: true,
            limitUnit: true,
            monitoringFrequency: true,
            complianceStatus: true,
            lastAssessedOn: true,
            nextDueOn: true,
          },
        },
      },
    });

    const now = new Date();

    const rows = permits
      .map((p) => ({
        ...p,
        conditions: p.conditions.map((c) => ({
          ...c,
          limitValue: c.limitValue === null ? null : Number(c.limitValue),
        })),
        urgency: permitUrgency(p, now),
        daysToExpiry: p.expiresOn ? daysUntil(p.expiresOn, now) : null,
      }))
      .sort((a, b) => {
        const rank = permitSortRank(a.urgency) - permitSortRank(b.urgency);
        if (rank !== 0) return rank;
        return (a.daysToExpiry ?? Number.MAX_SAFE_INTEGER) - (b.daysToExpiry ?? Number.MAX_SAFE_INTEGER);
      });

    return Response.json({
      data: rows,
      summary: summarisePermitRegister(permits, now),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...MANAGE_ROLES);

    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "permits", session.user.id),
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = createPermitSchema.parse(await req.json());

    if (body.facilityId) {
      const facility = await prisma.facility.findFirst({
        where: { id: body.facilityId, organizationId: orgId },
        select: { id: true },
      });
      if (!facility) return apiError("NOT_FOUND", "Facility not found in this organisation.", 404);
    }
    if (body.siteId) {
      const site = await prisma.site.findFirst({
        where: { id: body.siteId, organizationId: orgId },
        select: { id: true },
      });
      if (!site) return apiError("NOT_FOUND", "Site not found in this organisation.", 404);
    }

    const duplicate = await prisma.environmentalPermit.findFirst({
      where: { organizationId: orgId, reference: body.reference },
      select: { id: true },
    });
    if (duplicate) {
      return apiError(
        "DUPLICATE_REFERENCE",
        "A permit with that reference already exists in this organisation.",
        409,
      );
    }

    const permit = await prisma.environmentalPermit.create({
      data: {
        organizationId: orgId,
        type: body.type,
        reference: body.reference,
        issuingAuthority: body.issuingAuthority,
        title: body.title,
        description: body.description ?? null,
        status: body.status,
        facilityId: body.facilityId ?? null,
        siteId: body.siteId ?? null,
        issuedOn: body.issuedOn ?? null,
        effectiveFrom: body.effectiveFrom ?? null,
        expiresOn: body.expiresOn ?? null,
        renewalNoticeDays: body.renewalNoticeDays,
        ownerUserId: body.ownerUserId ?? null,
        notes: body.notes ?? null,
        createdByUserId: session.user.id,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "permit.created",
      resourceType: "EnvironmentalPermit",
      resourceId: permit.id,
      metadata: {
        reference: permit.reference,
        type: permit.type,
        expiresOn: permit.expiresOn?.toISOString() ?? null,
      },
    });

    return Response.json(permit, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
