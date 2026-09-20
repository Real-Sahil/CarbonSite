import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";

const CreateScenarioSchema = z.object({
  scenarioType: z.enum(["physical", "transition"]),
  name: z.string().min(1).max(255),
  temperaturePathway: z.string().max(50).optional(),
  timeHorizon: z.enum(["short", "medium", "long"]).default("medium"),
  description: z.string().max(2000).optional(),
  grossValueAtRiskLow: z.number().nonnegative().optional(),
  grossValueAtRiskHigh: z.number().nonnegative().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "viewer", "auditor");

    const { searchParams } = new URL(req.url);
    const scenarioType = searchParams.get("scenarioType") as
      | "physical"
      | "transition"
      | null;

    const scenarios = await prisma.tcfdScenario.findMany({
      where: {
        organizationId: orgId,
        ...(scenarioType ? { scenarioType } : {}),
      },
      include: {
        riskAssessments: {
          select: {
            id: true,
            riskCategory: true,
            likelihood: true,
            impact: true,
          },
        },
        createdBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ scenarios });
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

    const body = CreateScenarioSchema.parse(await req.json());

    const scenario = await prisma.tcfdScenario.create({
      data: {
        organizationId: orgId,
        scenarioType: body.scenarioType,
        name: body.name,
        temperaturePathway: body.temperaturePathway,
        timeHorizon: body.timeHorizon,
        description: body.description,
        grossValueAtRiskLow: body.grossValueAtRiskLow,
        grossValueAtRiskHigh: body.grossValueAtRiskHigh,
        createdByUserId: session.user.id,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "tcfd.scenario_created",
      resourceType: "TcfdScenario",
      resourceId: scenario.id,
      metadata: { name: body.name, scenarioType: body.scenarioType },
    });

    return NextResponse.json({ scenario }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
