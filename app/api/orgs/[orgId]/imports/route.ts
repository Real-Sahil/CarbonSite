export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { putObject, keys } from "@/lib/storage";
import { dispatchImport } from "@/lib/jobs/dispatch";
import { createHash } from "crypto";

// Inline job mode parses the CSV inside this request — allow time for it.
export const maxDuration = 60;

type Params = { params: Promise<{ orgId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor");
    const take = 50;

    const batches = await prisma.importBatch.findMany({
      where: { organizationId: orgId },
      include: {
        createdBy: { select: { name: true, email: true } },
        _count: { select: { stagedRecords: true, activityRecords: true } },
        stagedRecords: {
          where: { status: "staged" },
          take: 5,
          select: { validationErrors: true, rowNumber: true },
          orderBy: { rowNumber: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = batches.length > take;
    const data = hasMore ? batches.slice(0, take) : batches;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return NextResponse.json({ data, nextCursor });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");

    const formData = await req.formData();
    const file = formData.get("file");
    const reportingPeriodId = formData.get("reportingPeriodId");
    const templateKey = formData.get("templateKey");
    // Optional confirmed column mapping from the preview/mapping UI.
    // Stored as-is; the worker uses it in place of auto-detection.
    const columnMappingRaw = formData.get("columnMapping");
    let confirmedMapping: Record<string, string> | null = null;
    if (typeof columnMappingRaw === "string" && columnMappingRaw) {
      try {
        const parsed = JSON.parse(columnMappingRaw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          confirmedMapping = parsed as Record<string, string>;
        }
      } catch {
        // Ignore malformed mapping — worker falls back to auto-detection.
      }
    }

    if (!(file instanceof File)) {
      return apiError("BAD_REQUEST", "A file is required.", 400);
    }
    if (typeof reportingPeriodId !== "string" || !reportingPeriodId) {
      return apiError("BAD_REQUEST", "reportingPeriodId is required.", 400);
    }
    if (typeof templateKey !== "string" || !templateKey) {
      return apiError("BAD_REQUEST", "templateKey is required.", 400);
    }

    const allowedExts = [".csv", ".xlsx", ".xls", ".pdf"];
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!allowedExts.includes(ext)) {
      return apiError("BAD_REQUEST", "File must be a CSV, Excel, or PDF file.", 400);
    }
    if (file.size > 50 * 1024 * 1024) {
      return apiError("TOO_LARGE", "File must be under 50 MB.", 413);
    }

    // Verify period belongs to this org
    const period = await prisma.reportingPeriod.findUnique({
      where: { id: reportingPeriodId },
      select: { organizationId: true, status: true },
    });
    if (!period || period.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Reporting period not found.", 404);
    }
    if (period.status === "locked") {
      return apiError("LOCKED", "Reporting period is locked.", 409);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const checksum = createHash("sha256").update(buffer).digest("hex");

    // Create batch record first
    const batch = await prisma.importBatch.create({
      data: {
        organizationId: orgId,
        reportingPeriodId,
        templateKey,
        sourceFilename: file.name,
        sourceStorageKey: "pending",
        sourceChecksum: checksum,
        state: "uploaded",
        createdByUserId: session.user.id,
        ...(confirmedMapping ? { mapping: confirmedMapping } : {}),
      },
    });

    const storageKey = keys.importSource(orgId, batch.id);
    try {
      await putObject(storageKey, buffer, file.type || "text/csv");
    } catch (storageErr) {
      // Storage failed — clean up the orphan DB record before propagating
      await prisma.importBatch.delete({ where: { id: batch.id } }).catch(() => null);
      throw storageErr;
    }

    const updatedBatch = await prisma.importBatch.update({
      where: { id: batch.id },
      data: { sourceStorageKey: storageKey, state: "parsing" },
    });

    // Inline-mode aware: parses now when no worker process is deployed,
    // enqueues to pg-boss when JOB_PROCESSING_MODE=worker. Direct boss.send
    // here previously left every import stuck at "parsing" forever in the
    // default deployment. Failures are recorded on the batch state.
    await dispatchImport({ importBatchId: batch.id, orgId }).catch((err) =>
      console.error(`[imports] batch ${batch.id} failed:`, err),
    );

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "import.created",
      resourceType: "import_batch",
      resourceId: batch.id,
      metadata: { filename: file.name, templateKey },
    });

    // Re-fetch after dispatch so inline-mode callers get the final state
    // (ready_to_commit / needs_attention / failed) not the stale "parsing" snapshot.
    const finalBatch = await prisma.importBatch.findUnique({
      where: { id: batch.id },
      select: { id: true, state: true, errorCount: true },
    });

    return NextResponse.json(finalBatch ?? updatedBatch, { status: 202 });
  } catch (err) {
    return handleRouteError(err);
  }
}
