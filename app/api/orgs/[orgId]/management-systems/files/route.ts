export const dynamic = "force-dynamic";

// Uploads a file for a management system register (a controlled document, a
// training certificate, a calibration certificate) as the organisation's
// evidence, and returns its id for the row to keep.

import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { storeEvidenceFile } from "@/lib/evidence/store";
import { PQQ_EDITORS } from "@/lib/pqq/access";

const ALLOWED = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);
const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...PQQ_EDITORS);
    const limited = await rateLimitRequest(req, { key: rateLimitKey(orgId, "ms-files", session.user.id), limit: 30, windowMs: 60_000 });
    if (limited) return limited;

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return apiError("BAD_REQUEST", "Choose a file.", 400);
    if (!ALLOWED.has(file.type)) return apiError("UNSUPPORTED_TYPE", "Upload a PDF, image, Word, Excel, PowerPoint, CSV or text file.", 415);
    if (file.size > MAX_BYTES) return apiError("TOO_LARGE", "Files up to 25 MB.", 413);

    const stored = await storeEvidenceFile(orgId, session.user.id, { name: file.name, type: file.type, buffer: Buffer.from(await file.arrayBuffer()) });
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "evidence.uploaded",
      resourceType: "evidence_file",
      resourceId: stored.id,
      metadata: { filename: file.name, byteSize: file.size, mimeType: file.type, use: "management_system" },
    });
    return NextResponse.json({ evidenceId: stored.id, filename: file.name }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
