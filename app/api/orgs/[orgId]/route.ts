export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";
import { withApiVersion, checkDeprecationWarning } from "@/lib/api/versioned-handler";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { version, json } = await withApiVersion(_req);

    const deprecationWarning = checkDeprecationWarning(version);
    if (deprecationWarning) {
      console.warn(`[API v${version}] ${deprecationWarning}`);
    }

    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      include: {
        _count: {
          select: {
            memberships: true,
            facilities: true,
            reportingPeriods: true,
          },
        },
      },
    });

    return json(org, { version });
  } catch (err) {
    return handleRouteError(err);
  }
}

const UpdateOrgSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  industry: z.string().max(100).nullable().optional(),
  hqCountry: z.string().max(100).nullable().optional(),
  reportingCurrency: z.string().length(3).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { version, json } = await withApiVersion(req);
    const { session } = await requireOrgMember(orgId, "admin");

    const body = await req.json();
    const parsed = UpdateOrgSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid request body", 400, parsed.error.flatten());
    }

    const { name, industry, hqCountry, reportingCurrency } = parsed.data;
    if (name === undefined && industry === undefined && hqCountry === undefined && reportingCurrency === undefined) {
      return apiError("NO_FIELDS", "No updatable fields provided", 400);
    }

    const org = await prisma.organization.update({
      where: { id: orgId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(industry !== undefined ? { industry } : {}),
        ...(hqCountry !== undefined ? { hqCountry } : {}),
        ...(reportingCurrency !== undefined ? { reportingCurrency } : {}),
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "org.updated",
      resourceType: "Organization",
      resourceId: orgId,
      metadata: { fields: Object.keys(parsed.data) },
    });

    return json(org, { version });
  } catch (err) {
    return handleRouteError(err);
  }
}
