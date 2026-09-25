export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { DocumentReadError } from "@/lib/imports/parsers/pdf";
import { storeEvidenceFile } from "@/lib/evidence/store";
import { READABLE_BILL_TYPES, readBill } from "@/lib/evidence/read-bill";

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * "Add from a bill": stores the uploaded bill or receipt as evidence and
 * returns what could be read from it, with a confidence per value. The
 * person confirms or corrects the values; the page then creates the record
 * through POST /records and attaches this evidence to it.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "evidence-bill", session.user.id),
      limit: 20,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return apiError("BAD_REQUEST", "Choose a file to read.", 400);
    if (!READABLE_BILL_TYPES.has(file.type)) return apiError("UNSUPPORTED_TYPE", "Upload a PDF, JPG, PNG or WebP file.", 415);
    if (file.size > MAX_BYTES) return apiError("TOO_LARGE", "Files up to 10 MB can be read.", 413);

    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storeEvidenceFile(orgId, session.user.id, { name: file.name, type: file.type, buffer });
    const extraction = await readBill(orgId, session.user.id, { id: stored.id, mimeType: file.type }, buffer);
    return NextResponse.json({ evidenceId: stored.id, filename: file.name, ...extraction });
  } catch (err) {
    if (err instanceof DocumentReadError) return apiError(err.code, err.message, 422);
    return handleRouteError(err);
  }
}
