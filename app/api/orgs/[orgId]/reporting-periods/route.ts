import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { createReportingPeriodSchema } from "@/lib/validation/org";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(
      orgId,
      "admin",
      "editor",
      "reviewer",
      "viewer",
      "auditor",
      "field_worker",
    );

    const periods = await prisma.reportingPeriod.findMany({
      where: { organizationId: orgId },
      orderBy: { startDate: "desc" },
    });

    return NextResponse.json(periods);
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
    const { session } = await requireOrgMember(orgId, "admin", "editor");
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
      action: "record.created",
      resourceType: "reporting_period",
      resourceId: period.id,
      metadata: { label: period.label, type: period.type },
    });

    return NextResponse.json(period, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
