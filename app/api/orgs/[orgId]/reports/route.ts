import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createHash } from "crypto";
import { z } from "zod";

type Params = { params: Promise<{ orgId: string }> };

const createReportSchema = z.object({
  snapshotId: z.string().min(1),
  type: z.enum(["inventory", "monthly_snapshot", "audit_package"]),
  options: z.record(z.any()).optional(),
});

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor");
    const take = 20;

    const reports = await prisma.report.findMany({
      where: { organizationId: orgId },
      include: {
        reportingPeriod: { select: { label: true } },
        snapshot: { select: { version: true, publishedAt: true } },
        createdBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = reports.length > take;
    const data = hasMore ? reports.slice(0, take) : reports;
    return NextResponse.json({ data, nextCursor: hasMore ? data[data.length - 1].id : null });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");

    const body = createReportSchema.parse(await req.json());

    const snapshot = await prisma.publishedSnapshot.findUnique({
      where: { id: body.snapshotId },
      select: { organizationId: true, reportingPeriodId: true },
    });
    if (!snapshot || snapshot.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Snapshot not found.", 404);
    }

    // Idempotency — same snapshot + type + options = same report
    const requestHash = createHash("sha256")
      .update(`${orgId}:${body.snapshotId}:${body.type}:${JSON.stringify(body.options ?? {})}`)
      .digest("hex");

    const existing = await prisma.report.findUnique({
      where: { requestHash },
      select: { id: true, status: true },
    });
    if (existing && (existing.status === "queued" || existing.status === "generating")) {
      return NextResponse.json(existing);
    }

    const report = await prisma.report.create({
      data: {
        organizationId: orgId,
        reportingPeriodId: snapshot.reportingPeriodId,
        snapshotId: body.snapshotId,
        type: body.type,
        status: "queued",
        options: body.options ?? {},
        requestHash,
        createdByUserId: session.user.id,
      },
    });

    // Enqueue report generation job
    const { getBoss } = await import("@/lib/jobs/boss");
    const boss = await getBoss();
    await boss.send("reports", { reportId: report.id, orgId, snapshotId: body.snapshotId });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "report.generation_triggered",
      resourceType: "report",
      resourceId: report.id,
      metadata: { type: body.type, snapshotId: body.snapshotId },
    });

    return NextResponse.json(report, { status: 202 });
  } catch (err) {
    return handleRouteError(err);
  }
}
