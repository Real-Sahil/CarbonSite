export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { LINK_ISSUERS } from "@/lib/evidence/submission-link";

// DELETE: withdraw a link. Files already uploaded stay in the review list.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ orgId: string; id: string }> }) {
  try {
    const { orgId, id } = await params;
    const { session } = await requireOrgMember(orgId, ...LINK_ISSUERS);
    const done = await prisma.submissionLink.updateMany({ where: { id, organizationId: orgId, revokedAt: null }, data: { revokedAt: new Date() } });
    if (done.count === 0) return apiError("NOT_FOUND", "Link not found.", 404);
    await writeAuditLog({ organizationId: orgId, actorUserId: session.user.id, action: "evidence.link_revoked", resourceType: "SubmissionLink", resourceId: id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
