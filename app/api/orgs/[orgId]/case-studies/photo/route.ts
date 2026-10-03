export const dynamic = "force-dynamic";

// Uploads a case study photo as the organisation's evidence and returns its id
// for the case study to keep. Images only, so a board never prints another kind of file.

import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { storeEvidenceFile } from "@/lib/evidence/store";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
    const limited = await rateLimitRequest(req, { key: rateLimitKey(orgId, "case-study-photo", session.user.id), limit: 20, windowMs: 60_000 });
    if (limited) return limited;

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return apiError("BAD_REQUEST", "Choose a photo.", 400);
    if (!ALLOWED.has(file.type)) return apiError("UNSUPPORTED_TYPE", "Upload a JPEG, PNG or WebP image.", 415);
    if (file.size > MAX_BYTES) return apiError("TOO_LARGE", "Photos up to 5 MB.", 413);

    const stored = await storeEvidenceFile(orgId, session.user.id, { name: file.name, type: file.type, buffer: Buffer.from(await file.arrayBuffer()) });
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "evidence.uploaded",
      resourceType: "evidence_file",
      resourceId: stored.id,
      metadata: { filename: file.name, byteSize: file.size, mimeType: file.type, use: "case_study_photo" },
    });
    return NextResponse.json({ evidenceId: stored.id, filename: file.name }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
