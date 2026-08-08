import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";

const SbtiSchema = z.object({
  pathway: z.enum(["1.5C", "WB2C"]).default("1.5C"),
  baseYear: z.number().int().min(2000).max(2030),
  baselineScope1Tco2e: z.number().min(0),
  baselineScope2Tco2e: z.number().min(0),
  baselineScope3Tco2e: z.number().min(0).optional(),
  nearTermYear: z.number().int().min(2025).max(2040).default(2030),
  nearTermReductionPct: z.number().min(0).max(100),
  netZeroYear: z.number().int().min(2040).max(2100).default(2050),
  netZeroReductionPct: z.number().min(0).max(100).default(90),
  status: z.enum(["draft", "committed", "validated"]).default("draft"),
  notes: z.string().max(2000).optional(),
});

type Params = { params: Promise<{ orgId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "sustainability_director", "sustainability_manager", "editor", "viewer", "auditor");

    const target = await prisma.sbtiTarget.findUnique({ where: { organizationId: orgId } });

    // Build trajectory data: from baseYear to netZeroYear
    // Linear reduction from base to near-term, then to net-zero
    let trajectory: Array<{ year: number; targetTco2e: number; pathway: string }> = [];
    if (target) {
      const baseTotal =
        Number(target.baselineScope1Tco2e) +
        Number(target.baselineScope2Tco2e) +
        Number(target.baselineScope3Tco2e ?? 0);
      const nearTermTarget = baseTotal * (1 - Number(target.nearTermReductionPct) / 100);
      const netZeroTarget = baseTotal * (1 - Number(target.netZeroReductionPct) / 100);

      const currentYear = new Date().getFullYear();
      for (let year = target.baseYear; year <= target.netZeroYear; year++) {
        let targetTco2e: number;
        if (year <= target.baseYear) {
          targetTco2e = baseTotal;
        } else if (year <= target.nearTermYear) {
          const progress = (year - target.baseYear) / (target.nearTermYear - target.baseYear);
          targetTco2e = baseTotal - progress * (baseTotal - nearTermTarget);
        } else {
          const progress = (year - target.nearTermYear) / (target.netZeroYear - target.nearTermYear);
          targetTco2e = nearTermTarget - progress * (nearTermTarget - netZeroTarget);
        }
        if (year <= currentYear + 1) {
          trajectory.push({ year, targetTco2e: Math.max(0, targetTco2e), pathway: target.pathway });
        }
      }
    }

    return NextResponse.json({ target, trajectory });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "sustainability_director", "sustainability_manager");

    const body = SbtiSchema.parse(await req.json());

    const target = await prisma.sbtiTarget.upsert({
      where: { organizationId: orgId },
      update: body,
      create: { organizationId: orgId, ...body },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "record.updated",
      resourceType: "sbti_target",
      resourceId: target.id,
      metadata: { pathway: body.pathway, baseYear: body.baseYear, nearTermReductionPct: body.nearTermReductionPct },
    });

    return NextResponse.json(target);
  } catch (err) {
    return handleRouteError(err);
  }
}
