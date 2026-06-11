import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { dispatchReport } from "@/lib/jobs/dispatch";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
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
    const limited = rateLimit(req, {
      key: rateLimitKey(orgId, "reports", session.user.id),
      limit: 10,
      windowMs: 60_000,
    });
    if (limited) return limited;
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

    const processingMode =
      report.status === "queued"
        ? await dispatchReport({ orgId, reportId: report.id, snapshotId: body.snapshotId })
        : "existing";
    const currentReport =
      (await prisma.report.findUnique({ where: { id: report.id } })) ?? report;

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "report.generation_triggered",
      resourceType: "report",
      resourceId: report.id,
      metadata: { type: report.type, snapshotId: report.snapshotId, processingMode },
    });

    return NextResponse.json(currentReport, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
