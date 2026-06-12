import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { presignDownload } from "@/lib/storage";

type Params = { params: Promise<{ orgId: string; reportId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, reportId } = await params;
    const { session } = await requireOrgMember(
      orgId,
      "admin",
      "editor",
      "reviewer",
      "viewer",
      "auditor",
    );

    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        reportingPeriod: { select: { label: true } },
        snapshot: { select: { version: true, publishedAt: true } },
        createdBy: { select: { name: true, email: true } },
      },
    });

    if (!report || report.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Report not found.", 404);
    }

    // Generate presigned download URLs if the report is ready
    let pdfUrl: string | null = null;
    let csvUrl: string | null = null;
    if (report.status === "ready") {
      if (report.pdfStorageKey) {
        pdfUrl = await presignDownload(report.pdfStorageKey);
      }
      if (report.csvStorageKey) {
        csvUrl = await presignDownload(report.csvStorageKey);
      }

      await writeAuditLog({
        organizationId: orgId,
        actorUserId: session.user.id,
        action: "report.downloaded",
        resourceType: "report",
        resourceId: reportId,
      });
    }

    return NextResponse.json({ ...report, pdfUrl, csvUrl });
  } catch (err) {
    return handleRouteError(err);
  }
}
