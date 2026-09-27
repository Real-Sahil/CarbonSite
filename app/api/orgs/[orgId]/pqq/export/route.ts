export const dynamic = "force-dynamic";
export const maxDuration = 300;

// GET /api/orgs/[orgId]/pqq/export?set=<id>: the answer pack ZIP for a questionnaire.

import { NextRequest } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { zipResponse } from "@/lib/zip-response";
import { PQQ_EDITORS } from "@/lib/pqq/access";
import { loadQuestionSet } from "@/lib/pqq/sets";
import { writePqqPack } from "@/lib/pqq/pack";

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...PQQ_EDITORS);
    const set = await loadQuestionSet(orgId, req.nextUrl.searchParams.get("set") ?? "");
    if (!set) return apiError("NOT_FOUND", "Questionnaire not found.", 404);
    await writeAuditLog({ organizationId: orgId, actorUserId: session.user.id, action: "management_system.pqq_pack_exported", resourceType: "PqqQuestionSet", resourceId: set.id, metadata: { name: set.name } });
    const slug = set.name.replace(/[^\w.-]+/g, "-").slice(0, 40);
    return zipResponse(`answers-${slug}.zip`, (archive) => writePqqPack(archive, { orgId, set, generatedBy: session.user.email ?? session.user.id }));
  } catch (err) {
    return handleRouteError(err);
  }
}
