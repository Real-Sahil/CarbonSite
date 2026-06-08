import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { attachActivityRecordEvidenceSchema } from "@/lib/validation/org";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<unknown> },
) {
  try {
    const { orgId, importId } = (await params) as { orgId: string; importId: string };
    const { session } = await requireOrgMember(orgId, "admin", "editor");
    const body = attachActivityRecordEvidenceSchema.parse(await req.json());

    const [batch, evidence] = await Promise.all([
      prisma.importBatch.findFirst({
        where: { id: importId, organizationId: orgId },
        select: { id: true },
      }),
      prisma.evidenceFile.findFirst({
        where: { id: body.evidenceId, organizationId: orgId },
        select: { id: true, filename: true },
      }),
    ]);

    if (!batch) {
      return apiError("NOT_FOUND", "Import batch was not found.", 404);
    }
    if (!evidence) {
      return apiError("INVALID_EVIDENCE", "Evidence file does not belong to this organisation.", 422);
    }

    await prisma.importBatchEvidence.create({
      data: {
        organizationId: orgId,
        importBatchId: batch.id,
        evidenceFileId: evidence.id,
      },
    }).catch((err: unknown) => {
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        err.code === "P2002"
      ) {
        return null;
      }
      throw err;
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "import.evidence_attached",
      resourceType: "import_batch_evidence",
      resourceId: batch.id,
      metadata: {
        importBatchId: batch.id,
        evidenceFileId: evidence.id,
        filename: evidence.filename,
      },
    });

    return NextResponse.json({ importId: batch.id, evidenceId: evidence.id });
  } catch (err) {
    return handleRouteError(err);
  }
}
