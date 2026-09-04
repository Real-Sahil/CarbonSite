import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgMember } from "@/lib/auth/session";
import { calculateSBTiPathway } from "@/lib/calculation/sbti-calculator";
import { handleRouteError } from "@/lib/validation/api";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";

type Params = { params: Promise<{ orgId: string }> };

const sbtiRequestSchema = z.object({
  baselineYear: z.number().min(2000).max(2100),
  baselineEmissions: z.number().min(0),
  targetYear: z.number().min(2000).max(2100),
  pathway: z.enum(["1.5C", "2C", "2.5C"]),
  scope1: z.number().min(0).optional(),
  scope2: z.number().min(0).optional(),
  scope3: z.number().min(0).optional(),
});

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor");

    const body = await req.json();
    const input = sbtiRequestSchema.parse(body);

    const pathway = calculateSBTiPathway({
      baselineYear: input.baselineYear,
      baselineEmissions: input.baselineEmissions,
      targetYear: input.targetYear,
      pathway: input.pathway,
      baselineScope: input.scope1 !== undefined ? {
        scope1: input.scope1 || 0,
        scope2: input.scope2 || 0,
        scope3: input.scope3 || 0,
      } : undefined,
    });

    // Store pathway in database for tracking
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true },
    });

    if (!org) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Organization not found" },
        { status: 404 },
      );
    }

    // Log pathway creation
    await writeAuditLog({
      organizationId: orgId,
      action: "sbti.pathway_created",
      resourceType: "SBTiPathway",
      resourceId: `${input.baselineYear}-${input.targetYear}-${input.pathway}`,
      metadata: {
        pathway: input.pathway,
        baselineYear: input.baselineYear,
        targetYear: input.targetYear,
        baselineEmissions: input.baselineEmissions,
        targetEmissions: pathway.targetEmissions,
        totalReductionPercent: pathway.totalReductionPercent,
      },
    });

    return NextResponse.json(
      {
        success: true,
        pathway,
      },
      { status: 200 },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

