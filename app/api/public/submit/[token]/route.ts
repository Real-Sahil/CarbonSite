export const dynamic = "force-dynamic";
export const maxDuration = 300; // the background read runs inside this lifetime; same as the Read button's route

import { after, NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { documentFieldsSchema } from "@/lib/waste/documents";
import { readWasteDocument } from "@/lib/waste/read-document";
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

    let docFields: ReturnType<typeof documentFieldsSchema.parse> | null = null;
    if (link.purpose === "waste_documents") {
      const parsed = documentFieldsSchema.safeParse({ kind: form.get("kind"), title: form.get("title"), reference: form.get("reference"), issuer: form.get("issuer"), validUntil: form.get("validUntil") });
      if (!parsed.success) return apiError("VALIDATION_ERROR", "Choose what kind of document this is.", 422);
      docFields = parsed.data;
    }
    const uploadId = crypto.randomUUID();
    const accepted: string[] = [];
    const toRead: { orgId: string; id: string }[] = [];
    const skipped: string[] = [];
    for (const f of files) {
      const name = f.name.slice(0, 200) || "upload";
      const type = f.type.toLowerCase();
      if (!isReadableType(type)) { skipped.push(`${name}: not a PDF or photo`); continue; }
      if (f.size > MAX_LINK_FILE_BYTES) { skipped.push(`${name}: over 10 MB`); continue; }
      const buffer = Buffer.from(await f.arrayBuffer());
      if (!looksLike(type, buffer)) { skipped.push(`${name}: not a valid ${type.split("/")[1]}`); continue; }
      const stored = await storeEvidenceFile(link.organizationId, link.createdByUserId, { name, type, buffer });
      if (link.purpose === "waste_documents") {
        const created = await prisma.wasteDocument.create({
          data: {
            organizationId: link.organizationId,
            projectId: link.projectId,
            kind: docFields!.kind,
            title: docFields!.title ?? name.slice(0, 160),
            reference: docFields!.reference ?? null,
            issuer: docFields!.issuer ?? null,
            validUntil: docFields!.validUntil ? new Date(docFields!.validUntil) : null,
            note: who.data.note ?? null,
            evidenceFileId: stored.id,
            status: "pending",
            submissionLinkId: link.id,
            uploaderName: who.data.name,
            uploaderCompany: who.data.company ?? null,
          },
          select: { id: true },
        });
        if (docFields!.kind === "transfer_note") toRead.push({ orgId: link.organizationId, id: created.id });
        accepted.push(name);
        continue;
      }
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
    // Read transfer notes after the response, so the carrier is not kept waiting and the reviewer finds them
    // already read and checked. Best effort: a note that cannot be read just waits for the Read button.
    if (toRead.length > 0) {
      after(async () => {
        const started = Date.now();
        // A photo can take a minute: stop starting new reads near the end of the function's life; the rest wait for the Read button.
        for (const t of toRead) {
          if (Date.now() - started > 200_000) break;
          await readWasteDocument(t.orgId, t.id).catch(() => null);
        }
      });
    }
    return NextResponse.json({ ok: accepted.length > 0, accepted: accepted.length, skipped }, { status: accepted.length > 0 ? 201 : 422 });
  } catch (err) {
    return handleRouteError(err);
  }
}
