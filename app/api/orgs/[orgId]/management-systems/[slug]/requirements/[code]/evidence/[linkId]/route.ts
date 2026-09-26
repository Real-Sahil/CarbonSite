export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { MS_EDITORS } from "@/lib/management-systems/access";

type Params = { params: Promise<{ orgId: string; slug: string; code: string; linkId: string }> };

/** Unlink evidence. The record itself is untouched. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, slug, code: rawCode, linkId } = await params;
    const code = decodeURIComponent(rawCode);
    const { session } = await requireOrgMember(orgId, ...MS_EDITORS);
    const link = await prisma.msEvidenceLink.findFirst({
      where: { id: linkId, organizationId: orgId, frameworkSlug: slug, requirementCode: code },
    });
    if (!link) return apiError("NOT_FOUND", "Evidence link not found.", 404);
    await prisma.msEvidenceLink.delete({ where: { id: link.id } });
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "management_system.evidence_unlinked",
      resourceType: "MsEvidenceLink",
      resourceId: link.id,
      metadata: { frameworkSlug: slug, requirementCode: code, kind: link.kind, label: link.label },
    });
    return new Response(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
