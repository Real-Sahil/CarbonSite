export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";

type Params = { params: Promise<{ orgId: string; recordId: string }> };

// Per-record calculation explanation: latest EmissionCalculation with the
// factor, formula, methodology, and provenance needed for audit traceability.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, recordId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const record = await prisma.activityRecord.findUnique({
      where: { id: recordId },
      select: { organizationId: true },
    });
    if (!record || record.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Activity record not found.", 404);
    }

    const calculation = await prisma.emissionCalculation.findFirst({
      where: { organizationId: orgId, activityRecordId: recordId },
      include: {
        emissionFactor: {
          select: {
            externalId: true,
            inputUnit: true,
            co2: true,
            ch4: true,
            n2o: true,
            co2e: true,
            geographyCountry: true,
            usageNotes: true,
            uncertaintyRating: true,
          },
        },
        calculationRun: {
          select: {
            id: true,
            status: true,
            finishedAt: true,
            factorLibrary: { select: { name: true, version: true } },
            methodologyVersion: { select: { name: true, gwpVersion: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!calculation) {
      return apiError("NOT_FOUND", "No calculation exists for this record yet.", 404);
    }

    return NextResponse.json(calculation);
  } catch (err) {
    return handleRouteError(err);
  }
}
