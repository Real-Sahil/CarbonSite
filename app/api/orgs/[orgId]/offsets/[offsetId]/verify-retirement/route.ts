export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { verifyRetirement } from "@/lib/data-sources/offsets-db";
import { z } from "zod";

type Params = { params: Promise<{ orgId: string; offsetId: string }> };

const BodySchema = z.object({
  projectId: z.string().min(1),
  registry: z.string().optional(),
  serialNumbers: z.string().optional(),
}).optional();

/**
 * POST /api/orgs/:orgId/offsets/:offsetId/verify-retirement
 *
 * Queries OffsetsDB to verify a carbon credit retirement certificate,
 * then writes retirementVerified / retirementVerifiedAt / offsetsDbProjectId.
 * Body is optional — if omitted, uses retirementRef from the DB record as projectId.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId, offsetId } = await params;
    await requireOrgMember(orgId, "admin", "editor");

    const offset = await prisma.carbonOffset.findFirst({
      where: { id: offsetId, organizationId: orgId },
      select: { id: true, retirementRef: true, quantityTonnes: true },
    });

    if (!offset) return apiError("NOT_FOUND", "Carbon offset not found.", 404);

    const body = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid request body.", 400);
    }

    const projectId = parsed.data?.projectId ?? offset.retirementRef;
    if (!projectId) {
      return apiError(
        "MISSING_PROJECT_ID",
        "No projectId provided and no retirementRef on the offset record.",
        422,
      );
    }

    const result = await verifyRetirement({
      projectId,
      registry: parsed.data?.registry,
      serialNumbers: parsed.data?.serialNumbers,
      expectedQuantity: offset.quantityTonnes ? Number(offset.quantityTonnes) : undefined,
    });

    await prisma.carbonOffset.update({
      where: { id: offsetId },
      data: {
        retirementVerified: result.verified,
        retirementVerifiedAt: new Date(),
        offsetsDbProjectId: result.projectId ?? null,
      },
    });

    return NextResponse.json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
