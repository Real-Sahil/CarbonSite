import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { enqueueReport } from "@/lib/jobs/queues";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createReportSchema } from "@/lib/validation/org";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const reports = await prisma.report.findMany({
      where: { organizationId: orgId },
      include: {
        reportingPeriod: { select: { id: true, label: true } },
        snapshot: { select: { id: true, version: true, publishedAt: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json(reports);
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
    const { session } = await requireOrgMember(orgId, "admin", "editor", "reviewer");
    const body = createReportSchema.parse(await req.json());

    const snapshot = await prisma.publishedSnapshot.findFirst({
      where: {
        id: body.snapshotId,
        organizationId: orgId,
        reportingPeriodId: body.reportingPeriodId,
      },
      select: { id: true, reportingPeriodId: true },
    });

    if (!snapshot) {
      return apiError(
        "INVALID_SNAPSHOT",
        "Snapshot must belong to this organisation and reporting period.",
        422,
      );
    }

    const requestHash = createHash("sha256")
      .update([orgId, body.reportingPeriodId, body.snapshotId, body.type].join(":"))
      .digest("hex");

    const report = await prisma.report.upsert({
      where: { requestHash },
      update: {},
      create: {
        organizationId: orgId,
        reportingPeriodId: body.reportingPeriodId,
        snapshotId: body.snapshotId,
        type: body.type,
        status: "queued",
        requestHash,
        createdByUserId: session.user.id,
      },
    });

    if (report.status === "queued") {
      await enqueueReport({ orgId, reportId: report.id, snapshotId: body.snapshotId });
    }

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "report.generation_triggered",
      resourceType: "report",
      resourceId: report.id,
      metadata: { type: report.type, snapshotId: report.snapshotId },
    });

    return NextResponse.json(report, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
