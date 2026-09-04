export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { updateEngagementSchema } from "@/lib/validation/assurance";
import { checkSignOffReadiness } from "@/lib/assurance/engagement";

type Params = { params: Promise<{ orgId: string; engagementId: string }> };

const MANAGE_ROLES = ["admin", "sustainability_director", "auditor"] as const;

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, engagementId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const engagement = await prisma.assuranceEngagement.findFirst({
      where: { id: engagementId, organizationId: orgId },
      include: {
        reportingPeriod: { select: { label: true, startDate: true, endDate: true } },
        snapshot: { select: { id: true, version: true, publishedAt: true } },
        createdBy: { select: { name: true, email: true } },
        evidenceRequests: { orderBy: { reference: "asc" }, include: { owner: { select: { name: true, email: true } } } },
        samples: {
          orderBy: { createdAt: "desc" },
          include: {
            emissionCalculation: { select: { totalCo2e: true, activityRecord: { select: { sourceDescription: true, dataOrigin: true } } } },
            testedBy: { select: { name: true, email: true } },
          },
        },
        findings: {
          orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
          include: {
            raisedBy: { select: { name: true, email: true } },
            respondedBy: { select: { name: true, email: true } },
          },
        },
      },
    });
    if (!engagement) return apiError("NOT_FOUND", "Engagement not found.", 404);

    const readiness = checkSignOffReadiness({
      findings: engagement.findings,
      evidenceRequests: engagement.evidenceRequests,
    });

    return Response.json({
      ...engagement,
      materialityThresholdCo2e:
        engagement.materialityThresholdCo2e === null ? null : Number(engagement.materialityThresholdCo2e),
      materialityThresholdPercent:
        engagement.materialityThresholdPercent === null ? null : Number(engagement.materialityThresholdPercent),
      samples: engagement.samples.map((s) => ({
        ...s,
        emissionCalculation: s.emissionCalculation
          ? { ...s.emissionCalculation, totalCo2e: Number(s.emissionCalculation.totalCo2e) }
          : null,
      })),
      findings: engagement.findings.map((f) => ({
        ...f,
        quantifiedImpactCo2e: f.quantifiedImpactCo2e === null ? null : Number(f.quantifiedImpactCo2e),
      })),
      signOffReadiness: readiness,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, engagementId } = await params;
    const { session } = await requireOrgMember(orgId, ...MANAGE_ROLES);

    const existing = await prisma.assuranceEngagement.findFirst({
      where: { id: engagementId, organizationId: orgId },
      include: {
        findings: { select: { severity: true, status: true } },
        evidenceRequests: { select: { reference: true, status: true } },
      },
    });
    if (!existing) return apiError("NOT_FOUND", "Engagement not found.", 404);
    if (existing.status === "signed" || existing.status === "withdrawn") {
      return apiError(
        "ENGAGEMENT_CLOSED",
        `This engagement is ${existing.status} and cannot be edited further.`,
        409,
      );
    }

    const body = updateEngagementSchema.parse(await req.json());

    // Signing off is gated: every significant or material finding must be
    // resolved or formally qualified, and every evidence request settled.
    // An opinion issued around an open item is not an opinion, it is a guess.
    if (body.status === "signed") {
      const readiness = checkSignOffReadiness({
        findings: existing.findings,
        evidenceRequests: existing.evidenceRequests,
      });
      if (!readiness.canSignOff) {
        return apiError(
          "NOT_READY_TO_SIGN",
          `This engagement is not ready to sign off. ${readiness.blockers.join(" ")}`,
          422,
        );
      }
    }

    const signing = body.status === "signed";

    const engagement = await prisma.assuranceEngagement.update({
      where: { id: engagementId },
      data: {
        ...(body.status !== undefined && { status: body.status }),
        ...(body.providerName !== undefined && { providerName: body.providerName }),
        ...(body.leadAssurorName !== undefined && { leadAssurorName: body.leadAssurorName }),
        ...(body.leadAssurorEmail !== undefined && { leadAssurorEmail: body.leadAssurorEmail ?? null }),
        ...(body.materialityThresholdCo2e !== undefined && {
          materialityThresholdCo2e: body.materialityThresholdCo2e ?? null,
        }),
        ...(body.materialityThresholdPercent !== undefined && {
          materialityThresholdPercent: body.materialityThresholdPercent ?? null,
        }),
        ...(body.scopeDescription !== undefined && { scopeDescription: body.scopeDescription ?? null }),
        ...(body.plannedStartDate !== undefined && { plannedStartDate: body.plannedStartDate ?? null }),
        ...(body.plannedEndDate !== undefined && { plannedEndDate: body.plannedEndDate ?? null }),
        ...(body.opinionSummary !== undefined && { opinionSummary: body.opinionSummary ?? null }),
        ...(signing && { opinionIssuedAt: new Date() }),
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: signing ? "assurance.engagement_signed" : "assurance.engagement_updated",
      resourceType: "AssuranceEngagement",
      resourceId: engagement.id,
      metadata: { status: engagement.status, changedFields: Object.keys(body) },
    });

    return Response.json(engagement);
  } catch (err) {
    return handleRouteError(err);
  }
}
