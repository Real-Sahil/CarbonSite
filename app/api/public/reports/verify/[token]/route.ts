export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { writeAuditLog } from "@/lib/db/audit";
import { verifyAuditChain } from "@/lib/db/audit";
import { presignDownload } from "@/lib/storage";
import { apiError } from "@/lib/validation/api";

type Params = { params: Promise<{ token: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    // Rate limit by IP to prevent enumeration
    const limited = await rateLimitRequest(req, {
      key: "verify_report",
      limit: 30,
      windowMs: 60_000, // 1 minute window
    });
    if (limited) return limited;

    const { token } = await params;

    // 1. Look up the verification token
    const verificationToken = await prisma.reportVerificationToken.findUnique({
      where: { token },
      select: {
        id: true,
        reportId: true,
        organizationId: true,
        expiresAt: true,
        accessCount: true,
        maxAccessCount: true,
      },
    });

    if (!verificationToken) {
      return apiError(
        "TOKEN_NOT_FOUND",
        "Verification token not found or invalid.",
        404
      );
    }

    const now = new Date();

    // 2. Check if token has expired
    if (verificationToken.expiresAt <= now) {
      return apiError(
        "TOKEN_EXPIRED",
        "This verification token has expired.",
        410
      );
    }

    // 3. Check access count limits
    if (
      verificationToken.maxAccessCount &&
      verificationToken.accessCount >= verificationToken.maxAccessCount
    ) {
      return apiError(
        "ACCESS_LIMIT_EXCEEDED",
        "This verification token has reached its access limit.",
        429
      );
    }

    // 4. Fetch report with all necessary data
    const report = await prisma.report.findUnique({
      where: { id: verificationToken.reportId },
      select: {
        id: true,
        type: true,
        status: true,
        version: true,
        pdfStorageKey: true,
        csvStorageKey: true,
        pdfChecksum: true,
        csvChecksum: true,
        createdAt: true,
        publishedAt: true,
        organizationId: true,
        snapshot: {
          select: {
            id: true,
            publishedAt: true,
            version: true,
            reportingPeriod: { select: { label: true, startDate: true, endDate: true } },
          },
        },
        organization: { select: { name: true } },
      },
    });

    if (!report) {
      return apiError("REPORT_NOT_FOUND", "Report not found.", 404);
    }

    // 5. Fetch last 5 audit events related to this report
    const auditEvents = await prisma.auditLog.findMany({
      where: {
        organizationId: report.organizationId,
        OR: [
          { resourceId: report.id },
          { resourceId: report.snapshot.id },
        ],
      },
      select: {
        createdAt: true,
        action: true,
        actor: { select: { email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    // 6. Verify hash chain integrity
    const chainBrokenAt = await verifyAuditChain(report.organizationId);
    const chainVerified = chainBrokenAt === null;

    // 7. Generate presigned URLs if report is ready
    let pdfUrl: string | null = null;
    let csvUrl: string | null = null;

    if (report.status === "ready") {
      if (report.pdfStorageKey) {
        pdfUrl = await presignDownload(report.pdfStorageKey);
      }
      if (report.csvStorageKey) {
        csvUrl = await presignDownload(report.csvStorageKey);
      }
    }

    // 8. Increment access count (non-blocking update)
    prisma.reportVerificationToken
      .update({
        where: { id: verificationToken.id },
        data: { accessCount: { increment: 1 } },
      })
      .catch(() => {}); // Fire and forget

    // 9. Audit log the verification access
    await writeAuditLog({
      organizationId: report.organizationId,
      actorUserId: null, // Public action indicator
      action: "report.verification_accessed",
      resourceType: "Report",
      resourceId: report.id,
      metadata: {
        verificationTokenId: verificationToken.id,
        reportType: report.type,
        snapshotVersion: report.snapshot.version,
      },
    });

    // 10. Return public summary
    return NextResponse.json({
      report: {
        id: report.id,
        type: report.type,
        status: report.status,
        version: report.version,
        generatedAt: report.createdAt.toISOString(),
        sha256: report.pdfChecksum,
        orgName: report.organization.name,
        snapshotId: report.snapshot.id,
        snapshotVersion: report.snapshot.version,
        periodLabel: report.snapshot.reportingPeriod.label,
        periodStart: report.snapshot.reportingPeriod.startDate.toISOString(),
        periodEnd: report.snapshot.reportingPeriod.endDate.toISOString(),
        snapshotPublishedAt: report.snapshot.publishedAt?.toISOString(),
      },
      auditTrail: auditEvents.map((e) => ({
        timestamp: e.createdAt.toISOString(),
        actor: e.actor?.email ?? "system",
        action: e.action,
      })),
      integrity: {
        verified: chainVerified,
        brokenAt: chainBrokenAt ?? undefined,
        message: chainVerified
          ? "✓ Audit chain integrity verified"
          : `⚠ Audit chain broken at event ${chainBrokenAt}`,
      },
      downloads: report.status === "ready" ? {
        pdf: pdfUrl,
        csv: csvUrl,
      } : null,
    });
  } catch (err) {
    console.error("[verify-report]", err);
    return apiError(
      "INTERNAL_ERROR",
      "An error occurred while verifying the report.",
      500
    );
  }
}
