import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      include: {
        _count: {
          select: {
            memberships: true,
            facilities: true,
            reportingPeriods: true,
          },
        },
      },
    });

    return NextResponse.json(org);
  } catch (err) {
    return handleRouteError(err);
  }
}
