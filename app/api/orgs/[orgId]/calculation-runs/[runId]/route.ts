import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";

type Params = { params: Promise<{ orgId: string; runId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, runId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const run = await prisma.calculationRun.findUnique({
      where: { id: runId },
      include: {
        reportingPeriod: { select: { label: true } },
        factorLibrary: { select: { name: true, version: true } },
        methodologyVersion: { select: { name: true, gwpVersion: true } },
        triggeredBy: { select: { name: true, email: true } },
        _count: { select: { calculations: true } },
      },
    });

    if (!run || run.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Calculation run not found.", 404);
    }

    return NextResponse.json(run);
  } catch (err) {
    return handleRouteError(err);
  }
}
