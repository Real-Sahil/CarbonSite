export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { z } from "zod";
import { randomBytes } from "crypto";

const DEFAULT_EXPIRY_DAYS = 30;
const MAX_EXPIRY_DAYS = 365;

const createShareSchema = z.object({
  expiryDays: z.number().int().min(1).max(MAX_EXPIRY_DAYS).default(DEFAULT_EXPIRY_DAYS),
});

type Params = { params: Promise<{ orgId: string; snapshotId: string }> };

/**
 * POST /api/orgs/[orgId]/snapshots/[snapshotId]/share
 * Generate or rotate a time-limited share token for unauthenticated read-only access.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId, snapshotId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);

    const snapshot = await prisma.publishedSnapshot.findFirst({
      where: { id: snapshotId, organizationId: orgId },
      select: { id: true, reportingPeriodId: true },
    });
    if (!snapshot) return apiError("NOT_FOUND", "Snapshot not found.", 404);

    const body = createShareSchema.parse(await req.json());
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + body.expiryDays * 86_400_000);

    const updated = await prisma.publishedSnapshot.update({
      where: { id: snapshotId },
      data: { shareToken: token, shareTokenExpiresAt: expiresAt },
      select: { id: true, shareToken: true, shareTokenExpiresAt: true },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "snapshot.share_link_created",
      resourceType: "published_snapshot",
      resourceId: snapshotId,
      metadata: { expiryDays: body.expiryDays },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    return NextResponse.json({
      shareUrl: `${baseUrl}/shared/snapshots/${updated.shareToken}`,
      expiresAt: updated.shareTokenExpiresAt,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

/**
 * DELETE /api/orgs/[orgId]/snapshots/[snapshotId]/share
 * Revoke the share link immediately.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, snapshotId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);

    const snapshot = await prisma.publishedSnapshot.findFirst({
      where: { id: snapshotId, organizationId: orgId },
      select: { id: true },
    });
    if (!snapshot) return apiError("NOT_FOUND", "Snapshot not found.", 404);

    await prisma.publishedSnapshot.update({
      where: { id: snapshotId },
      data: { shareToken: null, shareTokenExpiresAt: null },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "snapshot.share_link_revoked",
      resourceType: "published_snapshot",
      resourceId: snapshotId,
      metadata: {},
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
