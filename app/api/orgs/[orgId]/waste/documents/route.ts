export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { orgRefsError } from "@/lib/security/org-refs";
import { storeEvidenceFile } from "@/lib/evidence/store";
import { LINK_ISSUERS, MAX_LINK_FILE_BYTES, isReadableType, looksLike } from "@/lib/evidence/submission-link";
import { documentFieldsSchema, documentState, KIND_VALUES } from "@/lib/waste/documents";

type Params = { params: Promise<{ orgId: string }> };

// GET: the waste paper trail, newest first. Filters narrow inside the organisation.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);
    const q = req.nextUrl.searchParams;
    const kind = q.get("kind");
    const status = q.get("status");
    const projectId = q.get("projectId");
    const docs = await prisma.wasteDocument.findMany({
      where: {
        organizationId: orgId,
        ...(kind && KIND_VALUES.includes(kind) ? { kind } : {}),
        ...(status && ["pending", "accepted", "rejected"].includes(status) ? { status } : {}),
        ...(projectId && /^[A-Za-z0-9_-]{1,64}$/.test(projectId) ? { projectId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    });
    return NextResponse.json({ data: docs.map((d) => ({ ...d, state: documentState(d.kind, d.validUntil) })) });
  } catch (err) {
    return handleRouteError(err);
  }
}

// POST (multipart): add a document. The team's own uploads are accepted at once.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...LINK_ISSUERS);
    const form = await req.formData();
    const get = (k: string) => (form.get(k) as string | null) ?? undefined;
    const fields = documentFieldsSchema.safeParse({ kind: get("kind"), title: get("title"), reference: get("reference"), issuer: get("issuer"), validUntil: get("validUntil"), note: get("note") });
    if (!fields.success) return apiError("VALIDATION_ERROR", "Check the document details.", 422, fields.error.flatten());
    const projectId = get("projectId") || null;
    const refs = await orgRefsError(orgId, { projectId });
    if (refs) return refs;
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return apiError("VALIDATION_ERROR", "Choose a PDF or photo.", 422);
    const type = file.type.toLowerCase();
    if (!isReadableType(type)) return apiError("VALIDATION_ERROR", "Only PDF and photos (JPEG, PNG, WebP).", 422);
    if (file.size > MAX_LINK_FILE_BYTES) return apiError("VALIDATION_ERROR", "Files can be up to 10 MB.", 422);
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!looksLike(type, buffer)) return apiError("VALIDATION_ERROR", "That file is not a valid " + type.split("/")[1] + ".", 422);

    const stored = await storeEvidenceFile(orgId, session.user.id, { name: file.name.slice(0, 200) || "document", type, buffer });
    const f = fields.data;
    const doc = await prisma.wasteDocument.create({
      data: {
        organizationId: orgId,
        projectId,
        kind: f.kind,
        title: f.title ?? file.name.slice(0, 160),
        reference: f.reference ?? null,
        issuer: f.issuer ?? null,
        validUntil: f.validUntil ? new Date(f.validUntil) : null,
        note: f.note ?? null,
        evidenceFileId: stored.id,
        status: "accepted",
        createdByUserId: session.user.id,
      },
    });
    await writeAuditLog({ organizationId: orgId, actorUserId: session.user.id, action: "waste_document.added", resourceType: "WasteDocument", resourceId: doc.id, metadata: { kind: f.kind, reference: f.reference ?? null } });
    return NextResponse.json({ id: doc.id }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
