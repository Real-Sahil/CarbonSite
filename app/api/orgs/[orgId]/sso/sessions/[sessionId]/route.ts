export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";

type Params = { params: Promise<{ orgId: string; sessionId: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { orgId, sessionId } = await params;
    await requireOrgMember(orgId, "admin");

    const session = await prisma.ssoSession.findFirst({
      where: { id: sessionId, organizationId: orgId },
    });

    if (!session) {
      return apiError("NOT_FOUND", "SSO session not found", 404);
    }

    await prisma.ssoSession.delete({
      where: { id: sessionId },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
