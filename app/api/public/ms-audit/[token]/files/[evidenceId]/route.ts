export const dynamic = "force-dynamic";

// One evidence file for an auditor link: only files the link's certification
// pack draws on (linked to its frameworks' requirements or attached to
// in-scope register rows), never any other file of the organisation.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { presignDownload } from "@/lib/storage";
import { resolveAuditorToken, touchAuditorAccess } from "@/lib/management-systems/auditor-access";
import { packEvidenceFileIds } from "@/lib/management-systems/certification-pack";

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string; evidenceId: string }> }) {
  try {
    const { token, evidenceId } = await params;
    const limited = await rateLimitRequest(req, { key: `ms-audit-file:${token.slice(0, 32)}`, limit: 300, windowMs: 60 * 60_000 });
    if (limited) return limited;
    const access = await resolveAuditorToken(token);
    if (!access) return apiError("NOT_FOUND", "This link has expired or been withdrawn.", 404);
    const allowed = await packEvidenceFileIds(access.organizationId, access.frameworks);
    if (!allowed.has(evidenceId)) return apiError("NOT_FOUND", "File not found.", 404);
    const file = await prisma.evidenceFile.findFirst({ where: { id: evidenceId, organizationId: access.organizationId }, select: { storageKey: true, filename: true } });
    if (!file?.storageKey || file.storageKey === "pending") return apiError("NOT_FOUND", "File not found.", 404);
    await touchAuditorAccess(access.id);
    await writeAuditLog({
      organizationId: access.organizationId,
      action: "evidence.download_requested",
      resourceType: "evidence_file",
      resourceId: evidenceId,
      metadata: { filename: file.filename, via: "auditor_link", auditor: access.name, accessId: access.id },
    });
    return NextResponse.redirect(await presignDownload(file.storageKey));
  } catch (err) {
    return handleRouteError(err);
  }
}
