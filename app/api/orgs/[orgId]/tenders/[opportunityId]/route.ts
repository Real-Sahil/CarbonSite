export const dynamic = "force-dynamic";

/** PATCH /api/orgs/{orgId}/tenders/{opportunityId} { status }: triage a matched notice. */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { TENDER_EDITORS } from "@/lib/tenders/fts";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";

const bodySchema = z.object({ status: z.enum(["new", "interested", "bidding", "dismissed"]) });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orgId: string; opportunityId: string }> }) {
  try {
    const { orgId, opportunityId } = await params;
    const { session } = await requireOrgMember(orgId, ...TENDER_EDITORS);
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return apiError("VALIDATION_ERROR", "Status must be new, interested, bidding or dismissed.", 400);
    const found = await prisma.tenderOpportunity.findFirst({ where: { id: opportunityId, organizationId: orgId }, select: { id: true, status: true, noticeId: true } });
    if (!found) return apiError("NOT_FOUND", "Tender not found.", 404);
    const updated = await prisma.tenderOpportunity.update({ where: { id: found.id }, data: { status: parsed.data.status } });
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "tender.status_changed",
      resourceType: "TenderOpportunity",
      resourceId: found.id,
      metadata: { noticeId: found.noticeId, from: found.status, to: parsed.data.status },
    });
    return NextResponse.json({ opportunity: updated });
  } catch (err) {
    return handleRouteError(err);
  }
}
