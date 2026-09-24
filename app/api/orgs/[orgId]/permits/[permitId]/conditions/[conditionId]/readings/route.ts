import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";
import { dispatchNotification } from "@/lib/jobs/dispatch";
import { nanoid } from "nanoid";

const CreateSchema = z.object({
  readingDate: z.string(),
  parameter: z.string().min(1),
  unit: z.string().min(1),
  limitValue: z.number().optional().nullable(),
  actualValue: z.number(),
  monitoringMethod: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string; permitId: string; conditionId: string }> }) {
  try {
    const { orgId, conditionId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);

    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get("cursor") ?? undefined;
    const take = Math.min(parseInt(searchParams.get("take") ?? "25"), 100);

    const readings = await prisma.dischargeReading.findMany({
      where: { organizationId: orgId, permitConditionId: conditionId },
      orderBy: { readingDate: "desc" },
      take: take + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });

    const hasMore = readings.length > take;
    const data = hasMore ? readings.slice(0, take) : readings;
    return NextResponse.json({ data, nextCursor: hasMore ? data[data.length - 1]?.id : null });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string; permitId: string; conditionId: string }> }) {
  try {
    const { orgId, permitId, conditionId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);

    const condition = await prisma.permitCondition.findUnique({
      where: { id: conditionId },
      include: { permit: { select: { reference: true, organizationId: true } } },
    });
    if (!condition || condition.permit.organizationId !== orgId) return apiError("NOT_FOUND", "Condition not found", 404);

    const body = CreateSchema.parse(await req.json());
    const exceedance = body.limitValue !== null && body.limitValue !== undefined && body.actualValue > body.limitValue;

    const reading = await prisma.dischargeReading.create({
      data: {
        id: nanoid(),
        organizationId: orgId,
        permitConditionId: conditionId,
        readingDate: new Date(body.readingDate),
        parameter: body.parameter,
        unit: body.unit,
        limitValue: body.limitValue ?? null,
        actualValue: body.actualValue,
        exceedance,
        monitoringMethod: body.monitoringMethod ?? null,
        notes: body.notes ?? null,
        createdByUserId: session.user.id,
      },
    });

    await writeAuditLog({
      organizationId: orgId, actorUserId: session.user.id,
      action: exceedance ? "discharge_reading.exceedance_flagged" : "discharge_reading.recorded",
      resourceType: "DischargeReading", resourceId: reading.id,
      metadata: { parameter: body.parameter, actualValue: body.actualValue, limitValue: body.limitValue, exceedance },
    });

    if (exceedance) {
      const admins = await prisma.organizationMembership.findMany({
        where: { organizationId: orgId, role: { in: ["admin", "editor"] }, terminatedAt: null },
        select: { userId: true },
      });
      for (const admin of admins) {
        await dispatchNotification({
          type: "discharge_reading_exceedance",
          recipientUserId: admin.userId,
          orgId,
          resourceId: permitId,
          metadata: { parameter: body.parameter, permitRef: condition.permit.reference ?? permitId },
        }).catch(() => null);
      }
    }

    return NextResponse.json(reading, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
