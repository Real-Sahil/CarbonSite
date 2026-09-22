export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";
import { nanoid } from "nanoid";

/**
 * POST — create a new draft revision from an approved/issued method statement.
 * The source is marked superseded; the new record carries revisionOf = source.id
 * and an incremented version number.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ orgId: string; msId: string }> }) {
  try {
    const { orgId, msId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");

    const source = await prisma.methodStatement.findUnique({
      where: { id: msId },
      select: {
        organizationId: true, title: true, version: true, status: true,
        projectId: true, siteId: true, riskAssessmentText: true,
        methodText: true, ppeRequired: true, sectionsJson: true,
        issuedAt: true, expiresAt: true,
      },
    });
    if (!source || source.organizationId !== orgId) return apiError("NOT_FOUND", "Method statement not found", 404);
    if (!["approved", "issued"].includes(source.status)) {
      return apiError("BAD_REQUEST", "Only approved or issued statements can be revised.", 400);
    }

    // Increment version: "1.0" → "2.0", "1.2" → "2.0", "3" → "4"
    const parts = source.version.split(".");
    const newVersion = `${(parseInt(parts[0] ?? "1") + 1)}.0`;

    const [newMs] = await prisma.$transaction([
      prisma.methodStatement.create({
        data: {
          id: nanoid(),
          organizationId: orgId,
          title: source.title,
          version: newVersion,
          status: "draft",
          projectId: source.projectId,
          siteId: source.siteId,
          riskAssessmentText: source.riskAssessmentText,
          methodText: source.methodText,
          ppeRequired: source.ppeRequired,
          sectionsJson: source.sectionsJson ?? undefined,
          revisionOf: msId,
          createdByUserId: session.user.id,
        },
      }),
      prisma.methodStatement.update({
        where: { id: msId },
        data: { status: "superseded" },
      }),
    ]);

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "method_statement.revised",
      resourceType: "MethodStatement",
      resourceId: newMs.id,
      metadata: { revisionOf: msId, newVersion },
    });

    return NextResponse.json(newMs, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
