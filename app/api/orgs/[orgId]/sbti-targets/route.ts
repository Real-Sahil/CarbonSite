import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";

const upsertSbtiTargetSchema = z.object({
  pathway: z.enum(["1.5C", "2.0C"]).optional(),
  baseYear: z.number().int().min(2000).max(2100),
  baselineScope1Tco2e: z.number().positive(),
  baselineScope2Tco2e: z.number().positive(),
  baselineScope3Tco2e: z.number().positive().optional(),
  nearTermYear: z.number().int().default(2030).optional(),
  nearTermReductionPct: z.number().min(0).max(100),
  netZeroYear: z.number().int().default(2050).optional(),
  netZeroReductionPct: z.number().min(0).max(100).default(90).optional(),
  notes: z.string().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.sustainability);

    const target = await prisma.sbtiTarget.findUnique({
      where: { organizationId: orgId },
      select: {
        id: true,
        pathway: true,
        baseYear: true,
        baselineScope1Tco2e: true,
        baselineScope2Tco2e: true,
        baselineScope3Tco2e: true,
        nearTermYear: true,
        nearTermReductionPct: true,
        netZeroYear: true,
        netZeroReductionPct: true,
        status: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(target);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(
      orgId,
      ...ROLE_GROUPS.sustainability
    );

    const body = await request.json();
    const {
      pathway = "1.5C",
      baseYear,
      baselineScope1Tco2e,
      baselineScope2Tco2e,
      baselineScope3Tco2e,
      nearTermYear = 2030,
      nearTermReductionPct,
      netZeroYear = 2050,
      netZeroReductionPct = 90,
      notes,
    } = upsertSbtiTargetSchema.parse(body);

    const existing = await prisma.sbtiTarget.findUnique({
      where: { organizationId: orgId },
    });

    if (existing) {
      const updated = await prisma.sbtiTarget.update({
        where: { id: existing.id },
        data: {
          pathway,
          baseYear,
          baselineScope1Tco2e: new Decimal(baselineScope1Tco2e),
          baselineScope2Tco2e: new Decimal(baselineScope2Tco2e),
          baselineScope3Tco2e: baselineScope3Tco2e
            ? new Decimal(baselineScope3Tco2e)
            : null,
          nearTermYear,
          nearTermReductionPct: new Decimal(nearTermReductionPct),
          netZeroYear,
          netZeroReductionPct: new Decimal(netZeroReductionPct),
          notes,
        },
      });

      await writeAuditLog({
        organizationId: orgId,
        actorUserId: session.user.id,
        action: "target.created",
        resourceType: "SbtiTarget",
        resourceId: updated.id,
        metadata: {
          pathway,
          baseYear,
          nearTermYear,
          netZeroYear,
        },
      });

      return NextResponse.json(updated);
    }

    const target = await prisma.sbtiTarget.create({
      data: {
        organizationId: orgId,
        pathway,
        baseYear,
        baselineScope1Tco2e: new Decimal(baselineScope1Tco2e),
        baselineScope2Tco2e: new Decimal(baselineScope2Tco2e),
        baselineScope3Tco2e: baselineScope3Tco2e
          ? new Decimal(baselineScope3Tco2e)
          : null,
        nearTermYear,
        nearTermReductionPct: new Decimal(nearTermReductionPct),
        netZeroYear,
        netZeroReductionPct: new Decimal(netZeroReductionPct),
        notes,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "target.created",
      resourceType: "SbtiTarget",
      resourceId: target.id,
      metadata: {
        pathway,
        baseYear,
        nearTermYear,
        netZeroYear,
      },
    });

    return NextResponse.json(target, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
