export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { createReportingPeriodSchema } from "@/lib/validation/org";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";

type Params = { params: Promise<{ orgId: string }> };

// GET /api/orgs/[orgId]/reporting-periods — list reporting periods for
// dropdowns (approvals, waste/water capture, completeness matrix, etc.)
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const periods = await prisma.reportingPeriod.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        type: true,
        startDate: true,
        endDate: true,
      },
      orderBy: { startDate: "desc" },
    });

    const formatted = periods.map((p) => {
      const year = p.startDate.getFullYear();
      let label = `${year}`;

      if (p.type === "quarter") {
        const month = p.startDate.getMonth();
        const quarter = Math.floor(month / 3) + 1;
        label += ` Q${quarter}`;
      } else if (p.type === "month") {
        label += ` ${p.startDate.toLocaleString("en-US", { month: "short" })}`;
      }

      return {
        id: p.id,
        label,
        startDate: p.startDate.toISOString().split("T")[0],
        endDate: p.endDate.toISOString().split("T")[0],
        type: p.type,
      };
    });

    return NextResponse.json({ periods: formatted });
  } catch (err) {
    return handleRouteError(err);
  }
}

// POST /api/orgs/[orgId]/reporting-periods — create a new reporting period
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");

    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "reporting-periods", session.user.id),
      limit: 20,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = createReportingPeriodSchema.parse(await req.json());

    const start = new Date(body.startDate);
    const end = new Date(body.endDate);
    if (start >= end) {
      return apiError("INVALID_DATE_RANGE", "startDate must be before endDate.", 422);
    }

    const period = await prisma.reportingPeriod.create({
      data: {
        organizationId: orgId,
        type: body.type,
        startDate: start,
        endDate: end,
        label: body.label,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "reporting_period.created",
      resourceType: "reporting_period",
      resourceId: period.id,
      metadata: { type: body.type, startDate: body.startDate, endDate: body.endDate, label: body.label },
    });

    return NextResponse.json(
      {
        id: period.id,
        label: period.label,
        type: period.type,
        startDate: period.startDate.toISOString().split("T")[0],
        endDate: period.endDate.toISOString().split("T")[0],
        status: period.status,
      },
      { status: 201 },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
