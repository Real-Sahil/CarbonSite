export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { DocumentReadError, documentText } from "@/lib/imports/parsers/pdf";
import { getObject } from "@/lib/storage";
import { LINK_ISSUERS } from "@/lib/evidence/submission-link";
import { englandRegistration, lookupCarrier } from "@/lib/waste/carrier-register";
import { extractTransferNote, suggestedFill } from "@/lib/waste/transfer-note-extractor";

// POST: read the document's file (PDF text layer, else OCR) and keep what it found as suggestions.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ orgId: string; id: string }> }) {
  try {
    const { orgId, id } = await params;
    const { session } = await requireOrgMember(orgId, ...LINK_ISSUERS);
    const doc = await prisma.wasteDocument.findFirst({ where: { id, organizationId: orgId } });
    if (!doc) return apiError("NOT_FOUND", "Document not found.", 404);
    const file = await prisma.evidenceFile.findFirst({ where: { id: doc.evidenceFileId, organizationId: orgId }, select: { mimeType: true, storageKey: true } });
    if (!file) return apiError("NOT_FOUND", "File not found.", 404);
    const { text, method } = await documentText(await getObject(file.storageKey), file.mimeType);
    const reading = extractTransferNote(text);
    // When the file names an England carrier registration, check it on the register too, so the reviewer sees
    // the carrier's status before accepting. A failed lookup never fails the read.
    const registration = englandRegistration(reading.carrierRegistration);
    const registerCheck = registration ? await lookupCarrier(registration) : undefined;
    await prisma.wasteDocument.update({ where: { id }, data: { extracted: { ...reading, method, ...(registerCheck && registerCheck.status !== "unavailable" ? { registerCheck } : {}) } } });
    await writeAuditLog({ organizationId: orgId, actorUserId: session.user.id, action: "evidence.extracted", resourceType: "WasteDocument", resourceId: id, metadata: { method, found: reading.found } });
    return NextResponse.json({ reading: { ...reading, method, ...(registerCheck && registerCheck.status !== "unavailable" ? { registerCheck } : {}) }, fill: suggestedFill(doc.kind, doc, reading) });
  } catch (err) {
    if (err instanceof DocumentReadError) return apiError(err.code, err.message, 422);
    return handleRouteError(err);
  }
}
