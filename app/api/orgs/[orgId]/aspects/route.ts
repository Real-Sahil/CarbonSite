export const dynamic = "force-dynamic";

// ISO 14001 clause 6.1.2 aspects and impacts register.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createAspectSchema } from "@/lib/validation/environment";
import {
  significanceScore,
  rateSignificance,
  requiresControl,
  summariseAspectRegister,
} from "@/lib/environment/aspects";

type Params = { params: Promise<{ orgId: string }> };

const MANAGE_ROLES = ["admin", "sustainability_director", "sustainability_manager", "editor"] as const;

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const aspects = await prisma.environmentalAspect.findMany({
      where: { organizationId: orgId },
      orderBy: [{ significanceScore: "desc" }, { activity: "asc" }],
      include: {
        facility: { select: { id: true, name: true } },
        owner: { select: { name: true, email: true } },
      },
    });

    return Response.json({
      data: aspects.map((a) => ({
        ...a,
        requiresControl: requiresControl(a.significance),
        hasControl:
          (a.existingControls?.trim().length ?? 0) > 0 ||
          (a.furtherAction?.trim().length ?? 0) > 0,
      })),
      summary: summariseAspectRegister(aspects),
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
      key: rateLimitKey(orgId, "aspects", session.user.id),
      limit: 40,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = createAspectSchema.parse(await req.json());

    if (body.facilityId) {
      const facility = await prisma.facility.findFirst({
        where: { id: body.facilityId, organizationId: orgId },
        select: { id: true },
      });
      if (!facility) return apiError("NOT_FOUND", "Facility not found in this organisation.", 404);
    }

    // Score and rating are derived server side so the register cannot hold a
    // rating that disagrees with its own inputs.
    const scores = {
      severityScore: body.severityScore,
      likelihoodScore: body.likelihoodScore,
      legalScore: body.legalScore,
    };
    const score = significanceScore(scores);
    const significance = rateSignificance(scores);

    const aspect = await prisma.environmentalAspect.create({
      data: {
        organizationId: orgId,
        facilityId: body.facilityId ?? null,
        activity: body.activity,
        aspect: body.aspect,
        impact: body.impact,
        operatingCondition: body.operatingCondition,
        severityScore: body.severityScore,
        likelihoodScore: body.likelihoodScore,
        legalScore: body.legalScore,
        significanceScore: score,
        significance,
        existingControls: body.existingControls ?? null,
        furtherAction: body.furtherAction ?? null,
        ownerUserId: body.ownerUserId ?? null,
        lastReviewedOn: body.lastReviewedOn ?? null,
        nextReviewOn: body.nextReviewOn ?? null,
        createdByUserId: session.user.id,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "aspect.created",
      resourceType: "EnvironmentalAspect",
      resourceId: aspect.id,
      metadata: { activity: aspect.activity, significance, significanceScore: score },
    });

    return Response.json(
      { ...aspect, requiresControl: requiresControl(significance) },
      { status: 201 },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
