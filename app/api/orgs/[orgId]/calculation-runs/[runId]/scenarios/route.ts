// POST: Create a scenario run with optional record modifications and return drafts
// GET: List scenario runs for a calculation run

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { z } from "zod";
import { runScenario } from "@/lib/calculation/scenario-runner";

const CreateScenarioSchema = z.object({
  modifications: z.record(
    z.string(),
    z.object({
      amountOverride: z.number().positive().optional(),
      unitOverride: z.string().optional(),
      activityDateOverride: z.string().datetime().optional(),
    }),
  ),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; runId: string }> },
) {
  try {
    const { orgId, runId } = await params;
    const session = await requireOrgMember(orgId, "editor", "admin");
    const userId = session.session.user.id;

    const body = await req.json();
    const parsed = CreateScenarioSchema.parse(body);

    // Verify calculation run belongs to this org
    const run = await prisma.calculationRun.findFirst({
      where: { id: runId, organizationId: orgId },
    });
    if (!run) {
      return apiError(
        "calculation_run_not_found",
        "Calculation run not found in this organization",
        404,
      );
    }

    // Convert modifications map and run scenario
    const modMap = new Map(
      Object.entries(parsed.modifications).map(([recordId, mod]) => [
        recordId,
        {
          activityRecordId: recordId,
          amountOverride: mod.amountOverride,
          unitOverride: mod.unitOverride,
          activityDateOverride: mod.activityDateOverride ? new Date(mod.activityDateOverride) : undefined,
        },
      ]),
    );

    const { scenarioRunId, draftCount } = await runScenario(
      runId,
      orgId,
      modMap,
      userId,
    );

    return NextResponse.json({
      scenarioRunId,
      draftCount,
      message: `Scenario created with ${draftCount} calculation drafts. Expires in 1 hour.`,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; runId: string }> },
) {
  try {
    const { orgId, runId } = await params;
    await requireOrgMember(orgId, "viewer", "editor", "reviewer", "admin");

    // List scenario runs for this calculation run
    const scenarios = await prisma.scenarioRun.findMany({
      where: {
        organizationId: orgId,
        calculationRunId: runId,
        expiresAt: { gt: new Date() }, // Only non-expired
      },
      select: {
        id: true,
        createdByUserId: true,
        createdAt: true,
        expiresAt: true,
        _count: { select: { drafts: true } },
        createdBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({ data: scenarios });
  } catch (err) {
    return handleRouteError(err);
  }
}
