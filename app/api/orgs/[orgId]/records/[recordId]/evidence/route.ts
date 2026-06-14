import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest, rateLimitKey } from "@/lib/security/rate-limit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { attachActivityRecordEvidenceSchema } from "@/lib/validation/org";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; recordId: string }> },
) {
  try {
    const { orgId, recordId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor", "reviewer");
    const limited = rateLimitRequest(req, {
      key: rateLimitKey(orgId, "record-evidence", session.user.id),
      limit: 60,
      windowMs: 60_000,
    });
    if (limited) return limited;
    const body = attachActivityRecordEvidenceSchema.parse(await req.json());

    const [record, evidence] = await Promise.all([
      prisma.activityRecord.findFirst({
        where: { id: recordId, organizationId: orgId },
        select: { id: true },
      }),
      prisma.evidenceFile.findFirst({
        where: { id: body.evidenceId, organizationId: orgId },
        select: { id: true, filename: true },
      }),
    ]);

    if (!record) {
      return apiError("NOT_FOUND", "Activity record was not found.", 404);
    }
    if (!evidence) {
      return apiError("INVALID_EVIDENCE", "Evidence file was not found for this organisation.", 422);
    }

    await prisma.$transaction([
      prisma.activityRecordEvidence.createMany({
        data: [
          {
            organizationId: orgId,
            activityRecordId: record.id,
            evidenceFileId: evidence.id,
          },
        ],
        skipDuplicates: true,
      }),
      prisma.activityRecord.update({
        where: { id: record.id },
        data: { evidenceStatus: "complete" },
      }),
    ]);

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "record.updated",
      resourceType: "activity_record",
      resourceId: record.id,
      metadata: {
        evidenceFileId: evidence.id,
        filename: evidence.filename,
        evidenceStatus: "complete",
      },
    });

    return NextResponse.json({ recordId: record.id, evidenceId: evidence.id });
  } catch (err) {
    return handleRouteError(err);
  }
}
