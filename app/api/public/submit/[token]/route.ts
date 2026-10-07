export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { storeEvidenceFile } from "@/lib/evidence/store";
import {
  MAX_FILES_PER_UPLOAD, MAX_LINK_FILE_BYTES, isReadableType, looksLike, resolveSubmissionToken, uploaderSchema,
} from "@/lib/evidence/submission-link";

/** A subcontractor's upload: who they are plus up to five PDFs or photos. No account needed. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const limited = await rateLimitRequest(req, { key: `submit-link:${token.slice(0, 16)}`, limit: 20, windowMs: 60 * 60_000 });
    if (limited) return limited;
    const link = await resolveSubmissionToken(token);
    if (!link) return apiError("NOT_FOUND", "This upload link has expired or been withdrawn. Ask for a new one.", 404);

    const form = await req.formData();
    const who = uploaderSchema.safeParse({
      name: form.get("name"),
      company: (form.get("company") as string | null) || undefined,
      note: (form.get("note") as string | null) || undefined,
    });
    if (!who.success) return apiError("VALIDATION_ERROR", "Please enter your name.", 422);
    const files = form.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) return apiError("VALIDATION_ERROR", "Choose at least one PDF or photo.", 422);
    if (files.length > MAX_FILES_PER_UPLOAD) return apiError("VALIDATION_ERROR", `Upload at most ${MAX_FILES_PER_UPLOAD} files at a time.`, 422);

    const uploadId = crypto.randomUUID();
    const accepted: string[] = [];
    const skipped: string[] = [];
    for (const f of files) {
      const name = f.name.slice(0, 200) || "upload";
      const type = f.type.toLowerCase();
      if (!isReadableType(type)) { skipped.push(`${name}: not a PDF or photo`); continue; }
      if (f.size > MAX_LINK_FILE_BYTES) { skipped.push(`${name}: over 10 MB`); continue; }
      const buffer = Buffer.from(await f.arrayBuffer());
      if (!looksLike(type, buffer)) { skipped.push(`${name}: not a valid ${type.split("/")[1]}`); continue; }
      const stored = await storeEvidenceFile(link.organizationId, link.createdByUserId, { name, type, buffer });
      await prisma.billInboxItem.upsert({
        where: { organizationId_emailId_evidenceFileId: { organizationId: link.organizationId, emailId: `link:${link.id}:${uploadId}`, evidenceFileId: stored.id } },
        create: {
          organizationId: link.organizationId,
          evidenceFileId: stored.id,
          emailId: `link:${link.id}:${uploadId}`,
          fromAddress: `${who.data.name}${who.data.company ? ` (${who.data.company})` : ""} via ${link.label}`.slice(0, 300),
          subject: who.data.note ?? null,
          submissionLinkId: link.id,
          projectId: link.projectId,
          uploaderName: who.data.name,
          uploaderCompany: who.data.company ?? null,
          uploaderNote: who.data.note ?? null,
        },
        update: {},
      });
      accepted.push(name);
    }
    if (accepted.length > 0) {
      await prisma.submissionLink.update({ where: { id: link.id }, data: { lastUsedAt: new Date(), uploadCount: { increment: accepted.length } } });
      await writeAuditLog({
        organizationId: link.organizationId,
        action: "evidence.link_upload",
        resourceType: "SubmissionLink",
        resourceId: link.id,
        metadata: { uploader: who.data.name, company: who.data.company ?? null, files: accepted.length, skipped },
      });
    }
    return NextResponse.json({ ok: accepted.length > 0, accepted: accepted.length, skipped }, { status: accepted.length > 0 ? 201 : 422 });
  } catch (err) {
    return handleRouteError(err);
  }
}
