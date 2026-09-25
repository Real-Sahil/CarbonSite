export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { requireFeature } from "@/lib/billing/limits";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { storeEvidenceFile } from "@/lib/evidence/store";

const ALLOWED = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const MAX_BYTES = 20 * 1024 * 1024;

/**
 * Stores a social value evidence file (payroll extract, training record,
 * timesheet) as the organisation's evidence and returns its download link,
 * which the delivery entry keeps in evidenceUrls. The link needs a signed-in
 * member of the organisation to open.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor, "contract_manager");
    const planGate = await requireFeature(orgId, "socialValue");
    if (planGate) return planGate;
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "sv-evidence", session.user.id),
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return apiError("BAD_REQUEST", "Choose a file.", 400);
    if (!ALLOWED.has(file.type)) return apiError("UNSUPPORTED_TYPE", "Upload a PDF, image, spreadsheet or Word document.", 415);
    if (file.size > MAX_BYTES) return apiError("TOO_LARGE", "Files up to 20 MB.", 413);

    const stored = await storeEvidenceFile(orgId, session.user.id, { name: file.name, type: file.type, buffer: Buffer.from(await file.arrayBuffer()) });
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "evidence.uploaded",
      resourceType: "evidence_file",
      resourceId: stored.id,
      metadata: { filename: file.name, byteSize: file.size, mimeType: file.type, use: "social_value" },
    });
    const url = new URL(`/api/orgs/${orgId}/evidence/${stored.id}/download`, req.nextUrl.origin).toString();
    return NextResponse.json({ evidenceId: stored.id, filename: file.name, url }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
