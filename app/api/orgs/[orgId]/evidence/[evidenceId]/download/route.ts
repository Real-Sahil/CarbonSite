import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { presignDownload } from "@/lib/storage";
import { apiError, handleRouteError } from "@/lib/validation/api";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; evidenceId: string }> },
) {
  try {
    const { orgId, evidenceId } = await params;
    const { session } = await requireOrgMember(
      orgId,
      "admin",
      "editor",
      "reviewer",
      "viewer",
      "auditor",
    );

    const evidence = await prisma.evidenceFile.findFirst({
      where: { id: evidenceId, organizationId: orgId },
    });

    if (!evidence) {
      return apiError("NOT_FOUND", "Evidence file was not found.", 404);
    }

    const downloadUrl = await presignDownload(evidence.storageKey);

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "evidence.downloaded",
      resourceType: "evidence_file",
      resourceId: evidence.id,
      metadata: {
        filename: evidence.filename,
        mimeType: evidence.mimeType,
      },
    });

    return NextResponse.json({ evidence, downloadUrl });
  } catch (err) {
    return handleRouteError(err);
  }
}
