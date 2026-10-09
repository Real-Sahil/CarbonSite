export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { LINK_ISSUERS } from "@/lib/evidence/submission-link";
import { REGISTER_ATTRIBUTION, REGISTER_LICENCE_URL } from "@/lib/waste/carrier-register";
import { lookupPermit, type PermitKind } from "@/lib/waste/permit-register";

// POST: look a site permit or exemption number up on England's public register and keep the result with
// the document. Only the number leaves the server.
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string; id: string }> }) {
  try {
    const { orgId, id } = await params;
    const { session } = await requireOrgMember(orgId, ...LINK_ISSUERS);
    const limited = await rateLimitRequest(req, { key: `permit-check:${session.user.id}`, limit: 30, windowMs: 60_000 });
    if (limited) return limited;
    const doc = await prisma.wasteDocument.findFirst({ where: { id, organizationId: orgId } });
    if (!doc) return apiError("NOT_FOUND", "Document not found.", 404);
    if (doc.kind !== "site_permit" && doc.kind !== "exemption") return apiError("VALIDATION_ERROR", "Only site permits and exemptions can be checked here.", 422);

    const read = (doc.extracted ?? {}) as { permit?: string };
    const result = await lookupPermit(doc.kind as PermitKind, doc.reference || read.permit || "");
    if (result.status !== "unavailable") {
      await prisma.wasteDocument.update({ where: { id }, data: { extracted: { ...(doc.extracted as object | null), permitCheck: result } } });
    }
    await writeAuditLog({ organizationId: orgId, actorUserId: session.user.id, action: "waste_document.reviewed", resourceType: "WasteDocument", resourceId: id, metadata: { permitRegisterCheck: result.status } });
    return NextResponse.json({ result, attribution: REGISTER_ATTRIBUTION, licence: REGISTER_LICENCE_URL });
  } catch (err) {
    return handleRouteError(err);
  }
}
