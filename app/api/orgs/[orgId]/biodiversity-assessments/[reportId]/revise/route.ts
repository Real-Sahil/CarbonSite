export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string; reportId: string }> }) {
  try {
    const { orgId, reportId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");

    const source = await prisma.biodiversityAssessment.findUnique({
      where: { id: reportId },
      select: { organizationId: true, status: true, version: true, revisionOf: true, title: true },
    });

    if (!source || source.organizationId !== orgId) return apiError("NOT_FOUND", "Biodiversity assessment not found", 404);
    if (!["approved", "issued", "signed_off"].includes(source.status)) {
      return apiError("INVALID_STATE", "Can only revise approved or issued assessments", 400);
    }

    const parts = source.version.split(".");
    const newVersion = `${parseInt(parts[0]) + 1}.0`;

    const [newReport] = await prisma.$transaction([
      prisma.biodiversityAssessment.create({
        data: {
          organizationId: orgId, title: source.title, version: newVersion, status: "draft",
          revisionOf: source.revisionOf || reportId, createdByUserId: session.user.id,
        },
      }),
      prisma.biodiversityAssessment.update({ where: { id: reportId }, data: { status: "superseded" } }),
    ]);

    await writeAuditLog({
      organizationId: orgId, actorUserId: session.user.id, action: "biodiversity_assessment.revised",
      resourceType: "BiodiversityAssessment", resourceId: reportId,
      metadata: { newRevisionId: newReport.id, newVersion },
    });

    return NextResponse.json(newReport, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
