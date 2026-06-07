import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { presignDownload } from "@/lib/storage";
import { apiError, handleRouteError } from "@/lib/validation/api";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; evidenceId: string }> },
) {
  try {
    const { orgId, evidenceId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const evidence = await prisma.evidenceFile.findFirst({
      where: { id: evidenceId, organizationId: orgId },
    });

    if (!evidence) {
      return apiError("NOT_FOUND", "Evidence file was not found.", 404);
    }

    const downloadUrl = await presignDownload(evidence.storageKey);
    return NextResponse.json({ evidence, downloadUrl });
  } catch (err) {
    return handleRouteError(err);
  }
}
