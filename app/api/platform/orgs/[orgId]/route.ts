import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePlatformMember } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";

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
