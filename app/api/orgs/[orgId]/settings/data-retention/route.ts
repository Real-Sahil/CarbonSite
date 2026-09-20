export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";

const retentionSchema = z.object({
  // NULL = keep forever (GDPR minimum: keep for duration of legal obligation)
  evidenceRetentionDays: z.number().int().min(90).max(3650).nullable(),
});

/**
 * GET /api/orgs/[orgId]/settings/data-retention
 * Return the org's current data retention policy.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { evidenceRetentionDays: true },
    });

    return NextResponse.json({
      evidenceRetentionDays: org?.evidenceRetentionDays ?? null,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

/**
 * PATCH /api/orgs/[orgId]/settings/data-retention
 * Update the org's data retention policy.
 * Minimum 90 days (UK GDPR: evidence must be kept for at least the duration
 * of any active audit obligation, recommended 7 years / 2555 days for GHG reports).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const body = retentionSchema.parse(await req.json());

    await prisma.organization.update({
      where: { id: orgId },
      data: { evidenceRetentionDays: body.evidenceRetentionDays },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "settings.data_retention_updated",
      resourceType: "organization",
      resourceId: orgId,
      metadata: { evidenceRetentionDays: body.evidenceRetentionDays },
    });

    return NextResponse.json({ evidenceRetentionDays: body.evidenceRetentionDays });
  } catch (err) {
    return handleRouteError(err);
  }
}
