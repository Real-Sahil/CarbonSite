export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { dispatchReport } from "@/lib/jobs/dispatch";
import { withApiVersion, checkDeprecationWarning } from "@/lib/api/versioned-handler";
import { createHash } from "crypto";
import { z } from "zod";
import { requireActiveBilling, requireWithinUsageLimit } from "@/lib/billing/limits";
import { recordUsage } from "@/lib/billing/usage";

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
    "csrd_esrs_e3",
    "csrd_esrs_e5",
    "contract_carbon",
    "ghg_protocol",
    "cdp",
    "cbam",
    "ppn_006_crp",
    "ecology_scan",
    "ecology_survey",
  ]),
  options: z.record(z.any()).optional(),
  auditEventFilter: z.array(z.string()).optional(),
});

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { version, json } = await withApiVersion(req);

    const deprecationWarning = checkDeprecationWarning(version);
    if (deprecationWarning) {
      console.warn(`[API v${version}] ${deprecationWarning}`);
    }

    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor");
    const take = 20;

    const where = { organizationId: orgId };

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        select: {
          id: true,
          organizationId: true,
          reportingPeriodId: true,
          snapshotId: true,
          type: true,
          status: true,
          version: true,
          pdfStorageKey: true,
          pdfChecksum: true,
          csvStorageKey: true,
          csvChecksum: true,
          xmlStorageKey: true,
          xmlChecksum: true,
          options: true,
          requestHash: true,
          contractId: true,
          createdByUserId: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true,
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
    return json({ data, nextCursor: hasMore ? data[data.length - 1].id : null, total }, { version });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { version, json } = await withApiVersion(req);

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
      select: { id: true, status: true, createdAt: true },
    });
    if (existing) {
      // "ready" → return as-is; "failed" → delete and retry.
      // "queued"/"generating" can get stuck if the Vercel function was killed
      // mid-run (timeout at maxDuration:60). Treat those as stale after 5 min
      // so the user can retry instead of being blocked permanently.
      const STALE_MS = 5 * 60 * 1000;
      const isStale =
        (existing.status === "queued" || existing.status === "generating") &&
        Date.now() - existing.createdAt.getTime() > STALE_MS;

      if (existing.status === "ready") {
        return json(existing, { version });
      }
      if (existing.status !== "failed" && !isStale) {
        return json(existing, { version });
      }
      await prisma.report.delete({ where: { id: existing.id } });
    }

    // Gated after the idempotency check above: retrying/regenerating an
    // already-requested report isn't new usage.
    const billingBlock = await requireActiveBilling(orgId);
    if (billingBlock) return billingBlock;
    const usageBlock = await requireWithinUsageLimit(orgId, "report.generated");
    if (usageBlock) return usageBlock;

    let report!: { id: string; organizationId: string; reportingPeriodId: string; snapshotId: string; type: string; status: string; version: number; pdfStorageKey: string | null; pdfChecksum: string | null; csvStorageKey: string | null; csvChecksum: string | null; xmlStorageKey: string | null; xmlChecksum: string | null; options: unknown; requestHash: string | null; contractId: string | null; createdByUserId: string | null; publishedAt: Date | null; createdAt: Date; updatedAt: Date };
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
        select: {
          id: true,
          organizationId: true,
          reportingPeriodId: true,
          snapshotId: true,
          type: true,
          status: true,
          version: true,
          pdfStorageKey: true,
          pdfChecksum: true,
          csvStorageKey: true,
          csvChecksum: true,
          xmlStorageKey: true,
          xmlChecksum: true,
          options: true,
          requestHash: true,
          contractId: true,
          createdByUserId: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true,
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
        if (race) return json(race, { version });
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

    await recordUsage({ organizationId: orgId, eventType: "report.generated" });

    return json(report, { status: 202, version });
  } catch (err) {
    return handleRouteError(err);
  }
}
