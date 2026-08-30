export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { withApiVersion } from "@/lib/api/versioned-handler";

type Params = { params: Promise<{ orgId: string; analysisId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, analysisId } = await params;
    const { version, json } = await withApiVersion(_req);

    await requireOrgMember(orgId, "admin", "editor", "viewer", "auditor");

    const run = await prisma.causalInferenceRun.findUnique({
      where: { id: analysisId },
    });

    if (!run || run.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Causal analysis not found.", 404);
    }

    return json(run, { version });
  } catch (err) {
    return handleRouteError(err);
  }
}
