export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createAssessmentSchema } from "@/lib/validation/ecology";
import { assessNetGain } from "@/lib/ecology/biodiversity-metric";
import { totalsFromAssessment } from "@/lib/ecology/assessment";

type Params = { params: Promise<{ orgId: string }> };

const MANAGE_ROLES = [
  "admin",
  "sustainability_director",
  "sustainability_manager",
  "operations_manager",
  "project_manager",
  "editor",
] as const;

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const assessments = await prisma.biodiversityAssessment.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      include: {
        project: { select: { id: true, name: true } },
        site: { select: { id: true, name: true } },
        managementPlan: { select: { id: true, commencesOn: true, endsOn: true } },
        _count: { select: { parcels: true, speciesRecords: true } },
      },
    });

    return Response.json({
      data: assessments.map((a) => {
        const result = assessNetGain(totalsFromAssessment(a));
        return {
          ...a,
          netGain: result,
          // Species work that would stop the job: a licence needed but not
          // granted is a criminal exposure, not a paperwork gap.
          requiresLicenceAction: undefined,
        };
      }),
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
      key: rateLimitKey(orgId, "biodiversity", session.user.id),
      limit: 20,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = createAssessmentSchema.parse(await req.json());

    if (body.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: body.projectId, organizationId: orgId },
        select: { id: true },
      });
      if (!project) return apiError("NOT_FOUND", "Project not found in this organisation.", 404);
    }
    if (body.siteId) {
      const site = await prisma.site.findFirst({
        where: { id: body.siteId, organizationId: orgId },
        select: { id: true },
      });
      if (!site) return apiError("NOT_FOUND", "Site not found in this organisation.", 404);
    }

    const assessment = await prisma.biodiversityAssessment.create({
      data: {
        organizationId: orgId,
        name: body.name,
        reference: body.reference ?? null,
        projectId: body.projectId ?? null,
        siteId: body.siteId ?? null,
        planningAuthority: body.planningAuthority ?? null,
        planningReference: body.planningReference ?? null,
        assessmentDate: body.assessmentDate ?? null,
        ecologistName: body.ecologistName ?? null,
        ecologistOrganisation: body.ecologistOrganisation ?? null,
        notes: body.notes ?? null,
        createdByUserId: session.user.id,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "biodiversity.assessment_created",
      resourceType: "BiodiversityAssessment",
      resourceId: assessment.id,
      metadata: { name: assessment.name, projectId: assessment.projectId },
    });

    return Response.json(assessment, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
