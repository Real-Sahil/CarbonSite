export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { LINK_ISSUERS } from "@/lib/evidence/submission-link";

type Ctx = { params: Promise<{ orgId: string; id: string }> };
const body = z.object({ status: z.enum(["accepted", "rejected"]) }).strict();

// PATCH: accept or reject a document a contractor sent in.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { orgId, id } = await params;
    const { session } = await requireOrgMember(orgId, ...LINK_ISSUERS);
    const { status } = body.parse(await req.json());
    const done = await prisma.wasteDocument.updateMany({ where: { id, organizationId: orgId }, data: { status, reviewedByUserId: session.user.id, reviewedAt: new Date() } });
    if (done.count === 0) return apiError("NOT_FOUND", "Document not found.", 404);
    await writeAuditLog({ organizationId: orgId, actorUserId: session.user.id, action: "waste_document.reviewed", resourceType: "WasteDocument", resourceId: id, metadata: { status } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}

// DELETE: remove the entry. The file stays in the organisation's evidence and the audit log keeps the record.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { orgId, id } = await params;
    const { session } = await requireOrgMember(orgId, ...LINK_ISSUERS);
    const done = await prisma.wasteDocument.deleteMany({ where: { id, organizationId: orgId } });
    if (done.count === 0) return apiError("NOT_FOUND", "Document not found.", 404);
    await writeAuditLog({ organizationId: orgId, actorUserId: session.user.id, action: "waste_document.deleted", resourceType: "WasteDocument", resourceId: id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
