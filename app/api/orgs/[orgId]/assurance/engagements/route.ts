export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createEngagementSchema } from "@/lib/validation/assurance";

type Params = { params: Promise<{ orgId: string }> };

const MANAGE_ROLES = ["admin", "sustainability_director", "auditor"] as const;

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const engagements = await prisma.assuranceEngagement.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      include: {
        reportingPeriod: { select: { label: true } },
        snapshot: { select: { id: true, version: true } },
        _count: { select: { evidenceRequests: true, samples: true, findings: true } },
      },
    });

    return Response.json({
      data: engagements.map((e) => ({
        ...e,
        materialityThresholdCo2e:
          e.materialityThresholdCo2e === null ? null : Number(e.materialityThresholdCo2e),
        materialityThresholdPercent:
          e.materialityThresholdPercent === null ? null : Number(e.materialityThresholdPercent),
      })),
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
      key: rateLimitKey(orgId, "assurance-engagements", session.user.id),
      limit: 15,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = createEngagementSchema.parse(await req.json());

    const period = await prisma.reportingPeriod.findFirst({
      where: { id: body.reportingPeriodId, organizationId: orgId },
      select: { id: true },
    });
    if (!period) return apiError("NOT_FOUND", "Reporting period not found in this organisation.", 404);

    if (body.snapshotId) {
      const snapshot = await prisma.publishedSnapshot.findFirst({
        where: { id: body.snapshotId, organizationId: orgId },
        select: { id: true },
      });
      if (!snapshot) return apiError("NOT_FOUND", "Snapshot not found in this organisation.", 404);
    }

    const engagement = await prisma.assuranceEngagement.create({
      data: {
        organizationId: orgId,
        reportingPeriodId: body.reportingPeriodId,
        snapshotId: body.snapshotId ?? null,
        standard: body.standard,
        level: body.level,
        providerName: body.providerName,
        leadAssurorName: body.leadAssurorName,
        leadAssurorEmail: body.leadAssurorEmail ?? null,
        materialityThresholdCo2e: body.materialityThresholdCo2e ?? null,
        materialityThresholdPercent: body.materialityThresholdPercent ?? null,
        scopeDescription: body.scopeDescription ?? null,
        plannedStartDate: body.plannedStartDate ?? null,
        plannedEndDate: body.plannedEndDate ?? null,
        createdByUserId: session.user.id,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "assurance.engagement_created",
      resourceType: "AssuranceEngagement",
      resourceId: engagement.id,
      metadata: {
        providerName: engagement.providerName,
        standard: engagement.standard,
        level: engagement.level,
      },
    });

    return Response.json(engagement, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
