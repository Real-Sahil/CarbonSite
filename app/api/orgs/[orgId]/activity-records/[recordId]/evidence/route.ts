import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { putObject, keys } from "@/lib/storage";
import { createHash } from "crypto";

type Params = { params: Promise<{ orgId: string; recordId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId, recordId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor", "reviewer");

    const record = await prisma.activityRecord.findUnique({
      where: { id: recordId },
      select: { organizationId: true },
    });
    if (!record || record.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Activity record not found.", 404);
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

    // Create EvidenceFile record first to get the ID for the storage key
    const evidenceFile = await prisma.evidenceFile.create({
      data: {
        organizationId: orgId,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        byteSize: file.size,
        storageKey: "pending", // will update after upload
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

    await prisma.activityRecordEvidence.create({
      data: {
        organizationId: orgId,
        activityRecordId: recordId,
        evidenceFileId: evidenceFile.id,
      },
    });

    // Update evidence status
    const evidenceCount = await prisma.activityRecordEvidence.count({
      where: { activityRecordId: recordId },
    });
    await prisma.activityRecord.update({
      where: { id: recordId },
      data: { evidenceStatus: evidenceCount > 0 ? "partial" : "missing" },
    });

    return NextResponse.json(
      { id: evidenceFile.id, filename: evidenceFile.filename },
      { status: 201 },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
