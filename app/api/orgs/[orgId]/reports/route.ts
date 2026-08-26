export const dynamic = "force-dynamic";

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
    "ghg_protocol",
    "cdp",
    "cbam",
    "ppn_006_crp",
  ]),
  options: z.record(z.any()).optional(),
  auditEventFilter: z.array(z.string()).optional(),
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
    if (existing) {
      // For idempotency: return existing report if queued/generating.
      // If failed/ready, allow retry by deleting and recreating.
      if (existing.status === "queued" || existing.status === "generating") {
        return NextResponse.json(existing);
      }
      // Delete the old report so we can retry with a new one
      await prisma.report.delete({ where: { id: existing.id } });
    }

    let report: Awaited<ReturnType<typeof prisma.report.create>>;
    try {
      const reportOptions = {
        ...body.options,
        ...(body.auditEventFilter ? { auditEventFilter: body.auditEventFilter } : {}),
      };
      report = await prisma.report.create({
        data: {
          organizationId: orgId,
          reportingPeriodId: snapshot.reportingPeriodId,
          snapshotId: body.snapshotId,
          type: body.type,
          status: "queued",
          options: reportOptions,
          requestHash,
          createdByUserId: session.user.id,
        },
      });
    } catch (err) {
      // Postgres rejects an unrecognised enum value with code 22P02.
      // This happens when the report_type DB enum is missing a newly-added value.
      const pgCode = (err as { code?: string }).code;
      console.error("[reports] report.create failed:", pgCode, err);
      if (pgCode === "22P02") {
        return apiError(
          "DB_ENUM_MISSING",
          `Report type "${body.type}" is not yet supported by the database. Run the pending Prisma migrations.`,
          500,
        );
      }
      if (pgCode === "P2002") {
        // Race condition: two concurrent requests with the same hash both
        // passed the findUnique check and both tried to create. Return the
        // winner's row so the client gets an idempotent response.
        const race = await prisma.report.findUnique({
          where: { requestHash },
          select: { id: true, status: true },
        });
        if (race) return NextResponse.json(race);
      }
      throw err; // re-throw; outer handler returns generic message
    }

    // Inline-mode aware: renders now when no worker process is deployed,
    // enqueues to pg-boss when JOB_PROCESSING_MODE=worker. Direct boss.send
    // here previously left every report stuck at "queued" forever in the
    // default deployment. Failures are recorded on the report status.
    try {
      await dispatchReport({ reportId: report.id, orgId, snapshotId: body.snapshotId });
    } catch (err) {
      console.error(`[reports] report ${report.id} dispatch failed:`, err);
      await prisma.report.update({
        where: { id: report.id },
        data: { status: "failed" },
      });
      return apiError("INTERNAL_ERROR", "Report generation could not be started.", 500);
    }

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
