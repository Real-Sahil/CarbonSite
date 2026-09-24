export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { presignDownload } from "@/lib/storage";

type Params = { params: Promise<{ orgId: string; evidenceId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, evidenceId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.reviewersAndEditors, "auditor");

    const evidence = await prisma.evidenceFile.findUnique({
      where: { id: evidenceId },
      select: {
        id: true,
        organizationId: true,
        filename: true,
        storageKey: true,
        byteSize: true,
        virusScanStatus: true,
      },
    });

    if (!evidence) {
      return apiError("NOT_FOUND", "Evidence file not found.", 404);
    }

    if (evidence.organizationId !== orgId) {
      return apiError("FORBIDDEN", "Access denied.", 403);
    }

    const downloadUrl = await presignDownload(evidence.storageKey);

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "evidence.download_requested",
      resourceType: "evidence_file",
      resourceId: evidenceId,
      metadata: {
        filename: evidence.filename,
        byteSize: evidence.byteSize,
        virusScanStatus: evidence.virusScanStatus,
      },
    });

    return NextResponse.redirect(downloadUrl);
  } catch (err) {
    return handleRouteError(err);
  }
}
