export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePlatformMember } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { PLAN_ORDER } from "@/lib/billing/limits";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requirePlatformMember();

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        branding: true,
        memberships: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: "asc" },
        },
        _count: {
          select: {
            activityRecords: true,
            contracts: true,
            importBatches: true,
            calculationRuns: true,
            reports: true,
          },
        },
      },
    });

    if (!org) return apiError("NOT_FOUND", "Organization not found.", 404);

    return NextResponse.json(org);
  } catch (err) {
    return handleRouteError(err);
  }
}

const PatchOrgSchema = z.object({
  plan: z.enum(PLAN_ORDER),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requirePlatformMember();

    const body = await req.json();
    const parsed = PatchOrgSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        "Invalid plan value.",
        400,
        parsed.error.flatten().fieldErrors,
      );
    }

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return apiError("NOT_FOUND", "Organization not found.", 404);

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: { plan: parsed.data.plan },
      select: { id: true, plan: true },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
