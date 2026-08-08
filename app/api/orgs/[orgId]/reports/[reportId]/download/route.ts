import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest, rateLimitKey } from "@/lib/security/rate-limit";
import { presignDownload } from "@/lib/storage";
import { apiError, handleRouteError } from "@/lib/validation/api";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; reportId: string }> },
) {
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
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "report-download", session.user.id),
      limit: 60,
      windowMs: 60_000,
    });
    if (limited) return limited;
    const artifact = req.nextUrl.searchParams.get("artifact") ?? "pdf";

    if (artifact !== "pdf" && artifact !== "csv" && artifact !== "xml") {
      return apiError("INVALID_ARTIFACT", "Artifact must be pdf, csv, or xml.", 422);
    }

    const report = await prisma.report.findFirst({
      where: { id: reportId, organizationId: orgId },
    });
    if (!report) {
      return apiError("NOT_FOUND", "Report was not found.", 404);
    }
    if (report.status !== "ready") {
      return apiError("REPORT_NOT_READY", "Report artefacts are not ready yet.", 422);
    }

    const storageKey =
      artifact === "pdf" ? report.pdfStorageKey
      : artifact === "xml" ? report.xmlStorageKey
      : report.csvStorageKey;
    if (!storageKey) {
      return apiError("ARTIFACT_MISSING", "Requested report artefact is missing.", 404);
    }

    const downloadUrl = await presignDownload(storageKey);

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "report.downloaded",
      resourceType: "report_download",
      resourceId: report.id,
      metadata: { artifact },
    });

    return NextResponse.json({ reportId: report.id, artifact, downloadUrl });
  } catch (err) {
    return handleRouteError(err);
  }
}
