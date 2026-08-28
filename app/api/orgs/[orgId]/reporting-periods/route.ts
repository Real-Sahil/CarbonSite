export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isMissingDatabaseObjectError } from "@/lib/db/prisma-errors";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { createReportingPeriodSchema } from "@/lib/validation/org";
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

    const { session, membership } = await requireOrgMember(
      orgId,
      "admin",
      "editor",
      "reviewer",
      "viewer",
      "auditor",
      "field_worker",
    );

    let periods;
    try {
      periods = await prisma.reportingPeriod.findMany({
        where: {
          organizationId: orgId,
          ...(membership.role === "field_worker"
            ? {
                fieldWorkerAssignments: {
                  some: { userId: session.user.id, organizationId: orgId },
                },
              }
            : {}),
        },
        orderBy: { startDate: "desc" },
      });
    } catch (err) {
      if (membership.role === "field_worker" && isMissingDatabaseObjectError(err)) {
        return json([]);
      }
      throw err;
    }

    return json(periods, { version });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { version, json } = await withApiVersion(req);
    const { session } = await requireOrgMember(orgId, "admin", "editor");
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "reporting-periods", session.user.id),
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;
    const body = createReportingPeriodSchema.parse(await req.json());

    const start = new Date(body.startDate);
    const end = new Date(body.endDate);

    if (start >= end) {
      return apiError(
        "INVALID_DATE_RANGE",
        "startDate must be before endDate.",
        422,
      );
    }

    const period = await prisma.reportingPeriod.create({
      data: {
        organizationId: orgId,
        type: body.type,
        startDate: start,
        endDate: end,
        label: body.label,
        status: "draft",
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "reporting_period.created",
      resourceType: "reporting_period",
      resourceId: period.id,
      metadata: { label: period.label, type: period.type },
    });

    return json(period, { status: 201, version });
  } catch (err) {
    return handleRouteError(err);
  }
}
