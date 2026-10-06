export const dynamic = "force-dynamic";

// Uploads a laboratory report, weighbridge ticket, note or load photograph as
// the organisation's evidence and returns its id for a classification or
// movement to keep.

import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { storeEvidenceFile } from "@/lib/evidence/store";
import { MATERIAL_EDITORS } from "@/lib/material/server";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...MATERIAL_EDITORS);
    const limited = await rateLimitRequest(req, { key: rateLimitKey(orgId, "material-file", session.user.id), limit: 30, windowMs: 60_000 });
    if (limited) return limited;
    const file = (await req.formData()).get("file");
    if (!(file instanceof File)) return apiError("BAD_REQUEST", "Choose a file.", 400);
    if (!ALLOWED.has(file.type)) return apiError("UNSUPPORTED_TYPE", "Upload a PDF, JPEG, PNG or WebP file.", 415);
    if (file.size > MAX_BYTES) return apiError("TOO_LARGE", "Files up to 15 MB.", 413);
    const stored = await storeEvidenceFile(orgId, session.user.id, { name: file.name, type: file.type, buffer: Buffer.from(await file.arrayBuffer()) });
    await writeAuditLog({
      organizationId: orgId, actorUserId: session.user.id, action: "evidence.uploaded", resourceType: "evidence_file", resourceId: stored.id,
      metadata: { filename: file.name, byteSize: file.size, mimeType: file.type, use: "material_movement" },
    });
    return NextResponse.json({ evidenceId: stored.id, filename: file.name }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
