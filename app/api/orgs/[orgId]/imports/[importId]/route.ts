export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { deleteObject } from "@/lib/storage";
import { withApiVersion, checkDeprecationWarning } from "@/lib/api/versioned-handler";

type Params = { params: Promise<{ orgId: string; importId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, importId } = await params;
    const { version } = await withApiVersion(_req);

    const deprecationWarning = checkDeprecationWarning(version);
    if (deprecationWarning) {
      console.warn(`[API v${version}] ${deprecationWarning}`);
    }

    await requireOrgMember(orgId, "admin", "editor");

    const batch = await prisma.importBatch.findFirst({
      where: { id: importId, organizationId: orgId },
      select: { id: true, state: true, sourceStorageKey: true, errorCsvStorageKey: true },
    });

    if (!batch) return apiError("NOT_FOUND", "Import batch not found.", 404);

    if (batch.state === "committed") {
      return apiError(
        "IMMUTABLE",
        "Committed import batches cannot be deleted — they have linked activity records.",
        409,
      );
    }

    // Delete storage objects (non-fatal if already gone)
    if (batch.sourceStorageKey && batch.sourceStorageKey !== "pending") {
      await deleteObject(batch.sourceStorageKey).catch(() => null);
    }
    if (batch.errorCsvStorageKey) {
      await deleteObject(batch.errorCsvStorageKey).catch(() => null);
    }

    await prisma.importBatch.delete({ where: { id: importId } });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
