import { createHash, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { dispatchImport } from "@/lib/jobs/dispatch";
import { keys, putObject } from "@/lib/storage";
import { apiError, handleRouteError } from "@/lib/validation/api";

const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".csv", ".xlsx"];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const imports = await prisma.importBatch.findMany({
      where: { organizationId: orgId },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { stagedRecords: true, activityRecords: true, evidence: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json(imports);
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
    const { session } = await requireOrgMember(orgId, "admin", "editor");
    const form = await req.formData();
    const file = form.get("file");
    const reportingPeriodId = String(form.get("reportingPeriodId") ?? "");
    const templateKey = String(form.get("templateKey") ?? "activity_csv");

    if (!(file instanceof File)) {
      return apiError("MISSING_FILE", "Attach a CSV or XLSX file.", 422);
    }

    const extension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return apiError("UNSUPPORTED_IMPORT_FILE", "Only CSV and XLSX imports are supported.", 422);
    }

    if (file.size <= 0 || file.size > MAX_IMPORT_BYTES) {
      return apiError("INVALID_IMPORT_SIZE", "Import files must be between 1 byte and 10 MB.", 422);
    }

    const period = await prisma.reportingPeriod.findFirst({
      where: { id: reportingPeriodId, organizationId: orgId },
      select: { id: true },
    });

    if (!period) {
      return apiError("INVALID_REPORTING_PERIOD", "Reporting period does not belong to this organisation.", 422);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const checksum = createHash("sha256").update(buffer).digest("hex");
    const idempotencyKey = createHash("sha256")
      .update([orgId, reportingPeriodId, templateKey, checksum].join(":"))
      .digest("hex");
    const existingBatch = await prisma.importBatch.findUnique({
      where: { idempotencyKey },
    });

    if (existingBatch) {
      return NextResponse.json(existingBatch, { status: 200 });
    }

    const importId = randomUUID();
    const sourceStorageKey = keys.importSource(orgId, importId, extension.replace(".", ""));

    await putObject(
      sourceStorageKey,
      buffer,
      file.type || (extension === ".csv" ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    );

    const batch = await prisma.importBatch.create({
      data: {
        id: importId,
        organizationId: orgId,
        reportingPeriodId,
        templateKey,
        state: "uploaded",
        sourceFilename: file.name,
        sourceStorageKey,
        sourceChecksum: checksum,
        createdByUserId: session.user.id,
        idempotencyKey,
      },
    });

    const processingMode = await dispatchImport({ orgId, importBatchId: batch.id });
    const currentBatch =
      (await prisma.importBatch.findUnique({ where: { id: batch.id } })) ?? batch;

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "import.created",
      resourceType: "import_batch",
      resourceId: batch.id,
      metadata: {
        sourceFilename: batch.sourceFilename,
        sourceChecksum: batch.sourceChecksum,
        templateKey: batch.templateKey,
        processingMode,
      },
    });

    return NextResponse.json(currentBatch, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
