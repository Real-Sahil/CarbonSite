import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { dispatchReport } from "@/lib/jobs/dispatch";
import { createHash } from "crypto";
import { z } from "zod";

// Inline job mode renders the PDF (Puppeteer) inside this request.
export const maxDuration = 60;

type Params = { params: Promise<{ orgId: string }> };

const createReportSchema = z.object({
  snapshotId: z.string().min(1),
  type: z.enum([
    "inventory",
    "monthly_snapshot",
    "audit_package",
    "secr",
    "ppn_06_21",
    "nhs_evergreen",
    "breeam_evidence",
    "national_toms",
    "csrd_esrs_e1",
    "contract_carbon",
  ]),
  options: z.record(z.any()).optional(),
});

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor");
    const take = 20;

    const where = { organizationId: orgId };

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        include: {
          reportingPeriod: { select: { label: true } },
          snapshot: { select: { version: true, publishedAt: true } },
          createdBy: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      prisma.report.count({ where }),
    ]);

    const hasMore = reports.length > take;
    const data = hasMore ? reports.slice(0, take) : reports;
    return NextResponse.json({ data, nextCursor: hasMore ? data[data.length - 1].id : null, total });
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

    // Inline-mode aware: renders now when no worker process is deployed,
    // enqueues to pg-boss when JOB_PROCESSING_MODE=worker. Direct boss.send
    // here previously left every report stuck at "queued" forever in the
    // default deployment. Failures are recorded on the report status.
    await dispatchReport({ reportId: report.id, orgId, snapshotId: body.snapshotId }).catch(
      (err) => console.error(`[reports] report ${report.id} failed:`, err),
    );

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
