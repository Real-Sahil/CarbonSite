export const dynamic = "force-dynamic";

import { PassThrough, Readable } from "node:stream";
import { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { ZipArchive } from "archiver";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { writeRecordBundle } from "@/lib/evidence/record-bundle";

type Params = { params: Promise<{ orgId: string; recordId: string }> };

/** One record's evidence bundle as a ZIP: the files, seals, audit entries and verify-evidence.mjs. */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId, recordId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);
    const limited = await rateLimitRequest(req, { key: rateLimitKey(orgId, "evidence-bundle", session.user.id), limit: 10, windowMs: 60_000 });
    if (limited) return limited;
    const exists = await prisma.activityRecord.findFirst({ where: { id: recordId, organizationId: orgId }, select: { id: true } });
    if (!exists) return apiError("NOT_FOUND", "Record not found.", 404);

    const archive = new ZipArchive({ zlib: { level: 6 } });
    const out = new PassThrough();
    archive.on("error", (err) => { Sentry.captureException(err); out.destroy(err); });
    archive.pipe(out);
    void writeRecordBundle(archive, orgId, recordId)
      .then(() => archive.finalize())
      .catch((err) => { Sentry.captureException(err); archive.abort(); out.destroy(err instanceof Error ? err : new Error(String(err))); });
    await writeAuditLog({ organizationId: orgId, actorUserId: session.user.id, action: "export.evidence_bundle", resourceType: "activity_record", resourceId: recordId, metadata: {} });
    return new Response(Readable.toWeb(out) as ReadableStream, {
      headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="evidence-${recordId}.zip"`, "Cache-Control": "no-store" },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
