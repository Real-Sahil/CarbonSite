export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { presignDownload } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await requireSession();
    const { id } = await params;

    const request = await prisma.dsarRequest.findUnique({ where: { id } });
    // Not-found and not-yours look identical to the caller — don't leak
    // whether some other user's request ID exists.
    if (!request || request.userId !== session.user.id) {
      return apiError("NOT_FOUND", "DSAR request not found.", 404);
    }

    let downloadUrl: string | undefined;
    if (request.status === "completed" && request.resultStorageKey) {
      downloadUrl = await presignDownload(request.resultStorageKey);
    }

    return NextResponse.json({ ...request, downloadUrl });
  } catch (err) {
    return handleRouteError(err);
  }
}
