import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { presignDownload } from "@/lib/storage";

type Params = { params: Promise<{ orgId: string; evidenceId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
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

    const file = await prisma.evidenceFile.findUnique({
      where: { id: evidenceId },
      select: { organizationId: true, storageKey: true, filename: true, mimeType: true },
    });

    if (!file || file.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Evidence file not found.", 404);
    }

    const url = await presignDownload(file.storageKey);

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "report.downloaded",
      resourceType: "evidence_file",
      resourceId: evidenceId,
    });

    // Redirect to presigned URL (works for both R2 and local dev)
    return NextResponse.redirect(url, { status: 302 });
  } catch (err) {
    return handleRouteError(err);
  }
}
