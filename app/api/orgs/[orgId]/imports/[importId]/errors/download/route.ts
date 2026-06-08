import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { presignDownload } from "@/lib/storage";
import { apiError, handleRouteError } from "@/lib/validation/api";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<unknown> },
) {
  try {
    const { orgId, importId } = (await params) as {
      orgId: string;
      importId: string;
    };
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const batch = await prisma.importBatch.findFirst({
      where: { id: importId, organizationId: orgId },
      select: {
        id: true,
        sourceFilename: true,
        errorCsvStorageKey: true,
        errorCount: true,
      },
    });

    if (!batch) {
      return apiError("NOT_FOUND", "Import batch was not found.", 404);
    }
    if (!batch.errorCsvStorageKey || batch.errorCount === 0) {
      return apiError("ERROR_EXPORT_MISSING", "This import has no error export.", 404);
    }

    const downloadUrl = await presignDownload(batch.errorCsvStorageKey);
    return NextResponse.json({
      importId: batch.id,
      sourceFilename: batch.sourceFilename,
      downloadUrl,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
