import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { presignDownload } from "@/lib/storage";

type Params = { params: Promise<{ orgId: string; importId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, importId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer");

    const batch = await prisma.importBatch.findUnique({
      where: { id: importId },
      select: { organizationId: true, errorCsvStorageKey: true },
    });
    if (!batch || batch.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Import batch not found.", 404);
    }
    if (!batch.errorCsvStorageKey) {
      return apiError("NOT_FOUND", "No error report available for this batch.", 404);
    }

    const url = await presignDownload(batch.errorCsvStorageKey);
    return NextResponse.redirect(url, { status: 302 });
  } catch (err) {
    return handleRouteError(err);
  }
}
