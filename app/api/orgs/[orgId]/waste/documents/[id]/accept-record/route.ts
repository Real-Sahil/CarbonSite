export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { orgRefsError } from "@/lib/security/org-refs";
import { LINK_ISSUERS } from "@/lib/evidence/submission-link";
import { acceptBodySchema, acceptTransferNote } from "@/lib/waste/accept";
import { loadTriage } from "@/lib/waste/triage-load";

// POST: a reviewer turns a transfer note a carrier sent into a waste record. The record goes through the
// same calculation as any waste record; the document is accepted and linked to it. One record per document.
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string; id: string }> }) {
  try {
    const { orgId, id } = await params;
    const { session } = await requireOrgMember(orgId, ...LINK_ISSUERS);
    const b = acceptBodySchema.parse(await req.json());
    const doc = await prisma.wasteDocument.findFirst({ where: { id, organizationId: orgId } });
    if (!doc) return apiError("NOT_FOUND", "Document not found.", 404);
    if (doc.kind !== "transfer_note") return apiError("NOT_A_TRANSFER_NOTE", "Only a transfer note can become a waste record.", 422);
    if (doc.wasteRecordId) return apiError("ALREADY_RECORDED", "This document already has a waste record.", 409);

    const refs = await orgRefsError(orgId, { facilityId: b.facilityId, reportingPeriodId: b.reportingPeriodId, projectId: b.projectId });
    if (refs) return refs;

    if (b.transferNoteReference && !b.allowDuplicate) {
      const dup = await prisma.wasteRecord.findFirst({
        where: { organizationId: orgId, transferNoteReference: { equals: b.transferNoteReference, mode: "insensitive" } },
        select: { id: true },
      });
      if (dup) return apiError("POSSIBLE_DUPLICATE", "A waste record with this transfer note reference already exists.", 409);
    }

    const suggestion = (await loadTriage(orgId, [doc])).get(id)?.suggestion ?? {};
    const recordId = await acceptTransferNote(orgId, session.user.id, id, b, suggestion, "review");
    if (!recordId) return apiError("ALREADY_RECORDED", "This document already has a waste record.", 409);
    return NextResponse.json({ wasteRecordId: recordId }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
