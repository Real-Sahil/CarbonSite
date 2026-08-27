export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin");

    const sessions = await prisma.ssoSession.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        userId: true,
        provider: true,
        lastActivityAt: true,
        createdAt: true,
      },
      orderBy: { lastActivityAt: "desc" },
    });

    return NextResponse.json(sessions);
  } catch (err) {
    return handleRouteError(err);
  }
}
