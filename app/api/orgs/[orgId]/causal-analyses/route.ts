export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { withApiVersion } from "@/lib/api/versioned-handler";
import { enqueueCausalAnalysis } from "@/lib/jobs/queues";
import { z } from "zod";

const createCausalAnalysisSchema = z.object({
  question: z.string().min(10).max(500),
  treatmentVariable: z.string().min(1).max(100),
  outcomeVariable: z.string().min(1).max(100),
  confounders: z.array(z.string()).min(0).max(10),
  selectedModelId: z.string().optional(),
});

type Params = { params: Promise<{ orgId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { version, json } = await withApiVersion(_req);

    await requireOrgMember(orgId, "admin", "editor", "viewer", "auditor");

    const runs = await prisma.causalInferenceRun.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return json({ data: runs }, { version });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { version, json } = await withApiVersion(req);
    const { session } = await requireOrgMember(orgId, "admin", "editor");

    const body = createCausalAnalysisSchema.parse(await req.json());

    const run = await prisma.causalInferenceRun.create({
      data: {
        organizationId: orgId,
        question: body.question,
        treatment: body.treatmentVariable,
        outcome: body.outcomeVariable,
        confounders: body.confounders,
        modelId: body.selectedModelId,
        status: "queued",
      },
    });

    // Enqueue the job — inline mode runs immediately, worker mode queues it
    await enqueueCausalAnalysis({ causalInferenceRunId: run.id, orgId }).catch(async (err) => {
      console.error(`[causal-analysis] run ${run.id} failed:`, err);
      await prisma.causalInferenceRun.update({
        where: { id: run.id },
        data: {
          status: "failed",
          errorMessage: err instanceof Error ? err.message.slice(0, 500) : "Dispatch failed.",
        },
      }).catch(() => {});
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "causal_analysis.run_triggered",
      resourceType: "causal_inference_run",
      resourceId: run.id,
      metadata: { question: body.question },
    });

    const finalRun = await prisma.causalInferenceRun.findUnique({
      where: { id: run.id },
    });

    return json(finalRun ?? run, { status: 202, version });
  } catch (err) {
    return handleRouteError(err);
  }
}
