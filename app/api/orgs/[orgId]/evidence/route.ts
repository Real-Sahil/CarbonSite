export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { keys, presignUpload, sanitizeStorageFilename } from "@/lib/storage";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { handleRouteError } from "@/lib/validation/api";
import { presignUploadSchema } from "@/lib/validation/org";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const files = await prisma.evidenceFile.findMany({
      where: { organizationId: orgId },
      include: { uploadedBy: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json(files);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor", "field_worker");
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "evidence_upload", session.user.id),
      limit: 40,
      windowMs: 60_000,
    });
    if (limited) return limited;
    const body = presignUploadSchema.parse(await req.json());
    const filename = sanitizeStorageFilename(body.filename);

    const evidence = await prisma.evidenceFile.create({
      data: {
        organizationId: orgId,
        filename,
        mimeType: body.contentType,
        byteSize: body.byteSize,
        checksum: body.checksum,
        storageKey: "",
        uploadedByUserId: session.user.id,
      },
    });
    const storageKey = keys.evidence(orgId, evidence.id, filename);
    const updated = await prisma.evidenceFile.update({
      where: { id: evidence.id },
      data: { storageKey },
    });
    const uploadUrl = await presignUpload(storageKey, body.contentType);

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "evidence.uploaded",
      resourceType: "evidence_file",
      resourceId: evidence.id,
      metadata: {
        filename,
        byteSize: body.byteSize,
        mimeType: body.contentType,
      },
    });

    return NextResponse.json({ evidence: updated, uploadUrl }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
