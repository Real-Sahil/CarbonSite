export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { presignDownload } from "@/lib/storage";
import { apiError, handleRouteError } from "@/lib/validation/api";

type Params = { params: Promise<{ orgId: string; contractId: string; submissionId: string }> };

/** A one-hour download link for the evidence a subcontractor attached. The key never leaves the server. */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, contractId, submissionId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const submission = await prisma.subcontractorCarbonSubmission.findFirst({
      where: { id: submissionId, contractId, organizationId: orgId },
      select: { evidenceStorageKey: true },
    });
    const key = submission?.evidenceStorageKey;
    if (!key || !key.startsWith(`org/${orgId}/`)) {
      return apiError("NOT_FOUND", "No evidence is attached to this submission.", 404);
    }

    return NextResponse.json({ url: await presignDownload(key) });
  } catch (err) {
    return handleRouteError(err);
  }
}
