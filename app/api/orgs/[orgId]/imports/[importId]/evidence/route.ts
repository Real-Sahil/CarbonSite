import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { putObject, keys } from "@/lib/storage";
import { createHash } from "crypto";

type Params = { params: Promise<{ orgId: string; importId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId, importId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");

    const batch = await prisma.importBatch.findUnique({
      where: { id: importId },
      select: { organizationId: true },
    });
    if (!batch || batch.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Import batch not found.", 404);
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return apiError("BAD_REQUEST", "A file is required.", 400);
    }
    if (file.size > 25 * 1024 * 1024) {
      return apiError("TOO_LARGE", "File must be under 25 MB.", 413);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const checksum = createHash("sha256").update(buffer).digest("hex");

    const evidenceFile = await prisma.evidenceFile.create({
      data: {
        organizationId: orgId,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        byteSize: file.size,
        storageKey: "pending",
        checksum,
        uploadedByUserId: session.user.id,
      },
    });

    const storageKey = keys.evidence(orgId, evidenceFile.id, file.name);
    await putObject(storageKey, buffer, file.type || "application/octet-stream");

    await prisma.evidenceFile.update({
      where: { id: evidenceFile.id },
      data: { storageKey },
    });

    await prisma.importBatchEvidence.create({
      data: {
        organizationId: orgId,
        importBatchId: importId,
        evidenceFileId: evidenceFile.id,
      },
    });

    return NextResponse.json(
      { id: evidenceFile.id, filename: evidenceFile.filename },
      { status: 201 },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
