export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders, "operations_manager", "contract_manager", "project_manager");

    const themes = await prisma.socialValueTheme.findMany({
      include: {
        measures: {
          where: { active: true },
          orderBy: { tomsCode: "asc" },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(themes);
  } catch (err) {
    return handleRouteError(err);
  }
}
