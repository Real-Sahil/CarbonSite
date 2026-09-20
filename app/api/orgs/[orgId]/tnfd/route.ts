import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";
import { nanoid } from "nanoid";

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  gbfTarget: z.string().optional().nullable(),
  timeHorizon: z.string().optional().nullable(),
  sectorScope: z.string().optional().nullable(),
  riskRating: z.string().optional().nullable(),
  locateNotes: z.string().optional().nullable(),
  evaluateNotes: z.string().optional().nullable(),
  assessNotes: z.string().optional().nullable(),
  prepareNotes: z.string().optional().nullable(),
  financialImpactLow: z.number().optional().nullable(),
  financialImpactHigh: z.number().optional().nullable(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get("cursor") ?? undefined;
    const take = Math.min(parseInt(searchParams.get("take") ?? "25"), 100);

    const scenarios = await prisma.tnfdScenario.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: take + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      select: {
        id: true, name: true, riskRating: true, timeHorizon: true,
        gbfTarget: true, financialImpactLow: true, financialImpactHigh: true, createdAt: true,
        createdBy: { select: { name: true } },
      },
    });

    const hasMore = scenarios.length > take;
    const data = hasMore ? scenarios.slice(0, take) : scenarios;
    return NextResponse.json({ data, nextCursor: hasMore ? data[data.length - 1]?.id : null });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");

    const body = CreateSchema.parse(await req.json());

    const scenario = await prisma.tnfdScenario.create({
      data: {
        id: nanoid(),
        organizationId: orgId,
        name: body.name,
        description: body.description ?? null,
        gbfTarget: body.gbfTarget ?? null,
        timeHorizon: body.timeHorizon ?? null,
        sectorScope: body.sectorScope ?? null,
        riskRating: body.riskRating ?? null,
        locateNotes: body.locateNotes ?? null,
        evaluateNotes: body.evaluateNotes ?? null,
        assessNotes: body.assessNotes ?? null,
        prepareNotes: body.prepareNotes ?? null,
        financialImpactLow: body.financialImpactLow ?? null,
        financialImpactHigh: body.financialImpactHigh ?? null,
        createdByUserId: session.user.id,
      },
    });

    await writeAuditLog({
      organizationId: orgId, actorUserId: session.user.id,
      action: "tnfd.scenario_created", resourceType: "TnfdScenario", resourceId: scenario.id,
      metadata: { name: scenario.name },
    });

    return NextResponse.json(scenario, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
