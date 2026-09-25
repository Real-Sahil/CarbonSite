export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest } from "next/server";
import { PassThrough, Readable } from "node:stream";
import * as Sentry from "@sentry/nextjs";
import { ZipArchive } from "archiver";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { writeAssurancePack } from "@/lib/assurance/pack";

type Params = { params: Promise<{ orgId: string; snapshotId: string }> };

/** Who may take the whole trail out: admins, the sustainability leads, reviewers and auditors. */
const PACK_ROLES = ["admin", "sustainability_director", "sustainability_manager", "reviewer", "auditor"] as const;

// GET /api/orgs/[orgId]/snapshots/[snapshotId]/assurance-pack[?engagementId=]
//
// Streams a ZIP of the snapshot's calculations, factors, evidence, audit
// trail and (for an engagement) its sample, with a SHA-256 manifest.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId, snapshotId } = await params;
    const { session } = await requireOrgMember(orgId, ...PACK_ROLES);

    const snapshot = await prisma.publishedSnapshot.findFirst({
      where: { id: snapshotId, organizationId: orgId },
      select: { id: true, version: true, reportingPeriod: { select: { label: true } } },
    });
    if (!snapshot) return apiError("NOT_FOUND", "Snapshot not found.", 404);

    const engagementId = req.nextUrl.searchParams.get("engagementId");
    if (engagementId) {
      const engagement = await prisma.assuranceEngagement.findFirst({ where: { id: engagementId, organizationId: orgId }, select: { id: true } });
      if (!engagement) return apiError("NOT_FOUND", "Engagement not found.", 404);
    }

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "assurance.pack_downloaded",
      resourceType: "published_snapshot",
      resourceId: snapshot.id,
      metadata: { engagementId },
    });

    const archive = new ZipArchive({ zlib: { level: 6 } });
    const out = new PassThrough();
    archive.on("error", (err) => {
      Sentry.captureException(err);
      out.destroy(err);
    });
    archive.pipe(out);
    void writeAssurancePack(archive, { orgId, snapshotId: snapshot.id, engagementId, generatedBy: session.user.id })
      .then(() => archive.finalize())
      .catch((err) => {
        Sentry.captureException(err);
        archive.abort();
        out.destroy(err instanceof Error ? err : new Error(String(err)));
      });

    const slug = snapshot.reportingPeriod.label.replace(/[^\w.-]+/g, "-").slice(0, 40);
    return new Response(Readable.toWeb(out) as ReadableStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="assurance-pack-${slug}-v${snapshot.version}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
