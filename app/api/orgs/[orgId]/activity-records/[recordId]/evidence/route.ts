export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { putObject, keys } from "@/lib/storage";
import { writeAuditLog } from "@/lib/db/audit";

type Params = { params: Promise<{ orgId: string; recordId: string }> };

const ALLOWED_MIMES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * GET /api/orgs/[orgId]/activity-records/[recordId]/evidence
 * List evidence files attached to activity record
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, recordId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.editor);

    const links = await prisma.activityRecordEvidence.findMany({
      where: { organizationId: orgId, activityRecordId: recordId },
      select: {
        evidenceFile: {
          select: {
            id: true,
            filename: true,
            byteSize: true,
            virusScanStatus: true,
            createdAt: true,
          },
        },
      },
    });

    return NextResponse.json(
      links.map((link) => ({
        id: link.evidenceFile.id,
        fileName: link.evidenceFile.filename,
        fileSizeBytes: link.evidenceFile.byteSize,
        virusScanStatus: link.evidenceFile.virusScanStatus,
        createdAt: link.evidenceFile.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

/**
 * POST /api/orgs/[orgId]/activity-records/[recordId]/evidence
 * Upload and attach evidence file to activity record
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId, recordId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);

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

    if (!ALLOWED_MIMES.includes(file.type)) {
      return apiError(
        "INVALID_FILE_TYPE",
        `File type ${file.type} not allowed.`,
        400
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return apiError(
        "TOO_LARGE",
        `File must be under 100 MB (got ${Math.round(file.size / 1024 / 1024)} MB).`,
        413
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const checksum = createHash("sha256").update(buffer).digest("hex");

    // Check if file already exists (deduplication)
    const existing = await prisma.evidenceFile.findFirst({
      where: {
        organizationId: orgId,
        checksum,
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.activityRecordEvidence.upsert({
        where: {
          activityRecordId_evidenceFileId: {
            activityRecordId: recordId,
            evidenceFileId: existing.id,
          },
        },
        update: {},
        create: {
          organizationId: orgId,
          activityRecordId: recordId,
          evidenceFileId: existing.id,
        },
      });

      await writeAuditLog({
        organizationId: orgId,
        actorUserId: session.user.id,
        action: "evidence.attached",
        resourceType: "evidence_file",
        resourceId: existing.id,
        metadata: {
          filename: file.name,
          byteSize: file.size,
          checksum,
          activityRecordId: recordId,
          isDuplicate: true,
        },
      });

      return NextResponse.json(
        {
          id: existing.id,
          fileName: file.name,
          fileSizeBytes: file.size,
          virusScanStatus: "skipped",
          isDuplicate: true,
        },
        { status: 201 }
      );
    }

    // Create new evidence file record
    const evidenceFile = await prisma.evidenceFile.create({
      data: {
        organizationId: orgId,
        filename: file.name,
        mimeType: file.type,
        byteSize: file.size,
        storageKey: "pending",
        checksum,
        uploadedByUserId: session.user.id,
        virusScanStatus: "skipped",
        scanTimestamp: new Date(),
        scanProvider: "none",
      },
    });

    // Upload to storage
    const storageKey = keys.evidence(orgId, evidenceFile.id, file.name);
    await putObject(storageKey, buffer, file.type);

    // Update storage key
    await prisma.evidenceFile.update({
      where: { id: evidenceFile.id },
      data: { storageKey },
    });

    // Link to activity record
    await prisma.activityRecordEvidence.create({
      data: {
        organizationId: orgId,
        activityRecordId: recordId,
        evidenceFileId: evidenceFile.id,
      },
    });

    // Update evidence status on record
    const evidenceCount = await prisma.activityRecordEvidence.count({
      where: { activityRecordId: recordId },
    });
    await prisma.activityRecord.update({
      where: { id: recordId },
      data: { evidenceStatus: evidenceCount > 0 ? "partial" : "missing" },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "evidence.uploaded",
      resourceType: "evidence_file",
      resourceId: evidenceFile.id,
      metadata: {
        filename: file.name,
        byteSize: file.size,
        checksum,
        activityRecordId: recordId,
      },
    });

    return NextResponse.json(
      {
        id: evidenceFile.id,
        fileName: file.name,
        fileSizeBytes: file.size,
        virusScanStatus: "skipped",
      },
      { status: 201 }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

/**
 * DELETE /api/orgs/[orgId]/activity-records/[recordId]/evidence
 * Remove evidence file from activity record
 * Query param: fileId
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { orgId, recordId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const fileId = new URL(req.url).searchParams.get("fileId");
    if (!fileId) {
      return apiError("BAD_REQUEST", "fileId query parameter required.", 400);
    }

    const link = await prisma.activityRecordEvidence.findFirst({
      where: {
        organizationId: orgId,
        activityRecordId: recordId,
        evidenceFileId: fileId,
      },
      select: { evidenceFile: { select: { filename: true } } },
    });

    if (!link) {
      return apiError("NOT_FOUND", "Evidence not found on this record.", 404);
    }

    await prisma.activityRecordEvidence.deleteMany({
      where: {
        organizationId: orgId,
        activityRecordId: recordId,
        evidenceFileId: fileId,
      },
    });

    const evidenceCount = await prisma.activityRecordEvidence.count({
      where: { activityRecordId: recordId },
    });
    await prisma.activityRecord.update({
      where: { id: recordId },
      data: { evidenceStatus: evidenceCount > 0 ? "partial" : "missing" },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "evidence.removed",
      resourceType: "evidence_file",
      resourceId: fileId,
      metadata: {
        filename: link.evidenceFile.filename,
        activityRecordId: recordId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
