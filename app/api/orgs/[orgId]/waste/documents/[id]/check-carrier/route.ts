export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { LINK_ISSUERS } from "@/lib/evidence/submission-link";
import { withCompanyStatus } from "@/lib/waste/carrier-company";
import { REGISTER_ATTRIBUTION, REGISTER_LICENCE_URL, englandRegistration, lookupCarrier } from "@/lib/waste/carrier-register";

// POST: look the document's carrier registration number up on England's public register and keep the
// result with the document. Only the registration number leaves the server.
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string; id: string }> }) {
  try {
    const { orgId, id } = await params;
    const { session } = await requireOrgMember(orgId, ...LINK_ISSUERS);
    const limited = await rateLimitRequest(req, { key: `carrier-check:${session.user.id}`, limit: 30, windowMs: 60_000 });
    if (limited) return limited;
    const doc = await prisma.wasteDocument.findFirst({ where: { id, organizationId: orgId } });
    if (!doc) return apiError("NOT_FOUND", "Document not found.", 404);

    // A licence's reference is the registration; for a transfer note it is the one read from the file.
    const read = (doc.extracted ?? {}) as { carrierRegistration?: string };
    const candidate = doc.kind === "carrier_licence" ? (englandRegistration(doc.reference) ?? read.carrierRegistration) : read.carrierRegistration;
    const result = await withCompanyStatus(await lookupCarrier(candidate ?? ""));
    if (result.status !== "unavailable") {
      await prisma.wasteDocument.update({ where: { id }, data: { extracted: { ...(doc.extracted as object | null), registerCheck: result } } });
    }
    await writeAuditLog({ organizationId: orgId, actorUserId: session.user.id, action: "waste_document.reviewed", resourceType: "WasteDocument", resourceId: id, metadata: { carrierRegisterCheck: result.status } });
    return NextResponse.json({ result, attribution: REGISTER_ATTRIBUTION, licence: REGISTER_LICENCE_URL });
  } catch (err) {
    return handleRouteError(err);
  }
}
