export const dynamic = "force-dynamic";

// Protected species records. Working without a licence where one is required
// is a criminal offence, so licence status is tracked separately from whether
// a survey has been done.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createSpeciesRecordSchema } from "@/lib/validation/ecology";

type Params = { params: Promise<{ orgId: string }> };

const MANAGE_ROLES = [
  "admin",
  "sustainability_director",
  "sustainability_manager",
  "operations_manager",
  "project_manager",
  "editor",
] as const;

/** Licence states that stop works proceeding. */
const BLOCKING_STATUSES = ["required", "applied", "refused", "expired"] as const;

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const records = await prisma.protectedSpeciesRecord.findMany({
      where: { organizationId: orgId },
      orderBy: [{ licenceStatus: "asc" }, { species: "asc" }],
      include: {
        assessment: { select: { id: true, name: true } },
        site: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    });

    const now = new Date();

    return Response.json({
      data: records.map((r) => ({
        ...r,
        // A granted licence past its expiry is no licence at all, so it is
        // reported as blocking rather than as granted.
        effectiveStatus:
          r.licenceStatus === "granted" &&
          r.licenceExpiresOn !== null &&
          r.licenceExpiresOn.getTime() < now.getTime()
            ? "expired"
            : r.licenceStatus,
      })),
      summary: {
        total: records.length,
        blockingWorks: records.filter((r) => {
          const expired =
            r.licenceStatus === "granted" &&
            r.licenceExpiresOn !== null &&
            r.licenceExpiresOn.getTime() < now.getTime();
          return expired || (BLOCKING_STATUSES as readonly string[]).includes(r.licenceStatus);
        }).length,
        granted: records.filter((r) => r.licenceStatus === "granted").length,
      },
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
      key: rateLimitKey(orgId, "species-records", session.user.id),
      limit: 40,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = createSpeciesRecordSchema.parse(await req.json());

    if (body.assessmentId) {
      const assessment = await prisma.biodiversityAssessment.findFirst({
        where: { id: body.assessmentId, organizationId: orgId },
        select: { id: true },
      });
      if (!assessment) {
        return apiError("NOT_FOUND", "Assessment not found in this organisation.", 404);
      }
    }

    const record = await prisma.protectedSpeciesRecord.create({
      data: {
        organizationId: orgId,
        assessmentId: body.assessmentId ?? null,
        siteId: body.siteId ?? null,
        projectId: body.projectId ?? null,
        species: body.species,
        legalProtection: body.legalProtection ?? null,
        surveyDate: body.surveyDate ?? null,
        surveyorName: body.surveyorName ?? null,
        findings: body.findings,
        licenceStatus: body.licenceStatus,
        licenceReference: body.licenceReference ?? null,
        licenceExpiresOn: body.licenceExpiresOn ?? null,
        mitigation: body.mitigation ?? null,
        seasonalConstraint: body.seasonalConstraint ?? null,
        notes: body.notes ?? null,
        createdByUserId: session.user.id,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "species_record.created",
      resourceType: "ProtectedSpeciesRecord",
      resourceId: record.id,
      metadata: { species: record.species, licenceStatus: record.licenceStatus },
    });

    return Response.json(record, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
