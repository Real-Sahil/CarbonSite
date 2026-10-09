export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { DocumentReadError } from "@/lib/imports/parsers/pdf";
import { readWasteDocument } from "@/lib/waste/read-document";
import { LINK_ISSUERS } from "@/lib/evidence/submission-link";

// POST: read the document's file (PDF text layer, else OCR) and keep what it found as suggestions.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ orgId: string; id: string }> }) {
  try {
    const { orgId, id } = await params;
    const { session } = await requireOrgMember(orgId, ...LINK_ISSUERS);
    const out = await readWasteDocument(orgId, id);
    if (!out) return apiError("NOT_FOUND", "Document not found.", 404);
    await writeAuditLog({ organizationId: orgId, actorUserId: session.user.id, action: "evidence.extracted", resourceType: "WasteDocument", resourceId: id, metadata: { method: out.reading.method, found: out.reading.found } });
    return NextResponse.json({ reading: out.reading, fill: out.fill });
  } catch (err) {
    if (err instanceof DocumentReadError) return apiError(err.code, err.message, 422);
    return handleRouteError(err);
  }
}
