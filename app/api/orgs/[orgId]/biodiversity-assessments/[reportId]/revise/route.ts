export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";
import { WORKFLOWS, nextMajorVersion } from "@/lib/structured-forms/workflows";
import { omit } from "@/lib/structured-forms/server";

type Params = { params: Promise<{ orgId: string; reportId: string }> };

const workflow = WORKFLOWS["biodiversity-assessments"];

// A new metric version is a new document: the approved one stays intact for the
// planning record, parcels are copied into a fresh draft, and species survey
// records move to the version that is now current.
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, reportId } = await params;
    const { session } = await requireOrgMember(orgId, "admin");

    const source = await prisma.biodiversityAssessment.findFirst({
      where: { id: reportId, organizationId: orgId },
      include: { parcels: true },
    });
    if (!source) return apiError("NOT_FOUND", "Biodiversity assessment not found.", 404);
    if (!workflow.revise?.from.includes(source.status)) {
      return apiError(
        "INVALID_STATE",
        `A new version can only be started from an approved assessment. This one is ${source.status}.`,
        409,
      );
    }

    const newVersion = nextMajorVersion(source.version);
    const assessmentFields = omit(source, [
      "id", "createdAt", "updatedAt", "lockedAt", "signedOffAt", "signedOffByUserId", "parcels", "sectionsJson",
    ]);

    const created = await prisma.$transaction(async (tx) => {
      const next = await tx.biodiversityAssessment.create({
        data: {
          ...assessmentFields,
          sectionsJson: source.sectionsJson ?? Prisma.JsonNull,
          status: "draft",
          version: newVersion,
          revisionOf: source.revisionOf ?? source.id,
          createdByUserId: session.user.id,
        },
        select: { id: true, version: true },
      });

      if (source.parcels.length > 0) {
        await tx.habitatParcel.createMany({
          data: source.parcels.map((parcel) => ({
            ...omit(parcel, ["id", "createdAt", "updatedAt"]),
            assessmentId: next.id,
          })),
        });
      }

      await tx.protectedSpeciesRecord.updateMany({
        where: { assessmentId: source.id, organizationId: orgId },
        data: { assessmentId: next.id },
      });

      await tx.biodiversityAssessment.update({
        where: { id: source.id },
        data: { status: "superseded" },
      });

      return next;
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "biodiversity_assessment.revised",
      resourceType: "BiodiversityAssessment",
      resourceId: created.id,
      metadata: { revisionOfId: source.id, fromVersion: source.version, newVersion, parcelsCopied: source.parcels.length },
    });
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "biodiversity_assessment.superseded",
      resourceType: "BiodiversityAssessment",
      resourceId: source.id,
      metadata: { supersededById: created.id },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
