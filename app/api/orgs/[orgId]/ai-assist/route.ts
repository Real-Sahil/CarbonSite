export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";

const Body = z.object({ enabled: z.boolean() });

/** Admins turn AI-assisted wording on or off for the organisation. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin");
    const { enabled } = Body.parse(await req.json());
    await prisma.organization.update({ where: { id: orgId }, data: { aiAssistEnabled: enabled } });
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "org.ai_assist_changed",
      resourceType: "Organization",
      resourceId: orgId,
      metadata: { enabled },
    });
    return NextResponse.json({ enabled });
  } catch (err) {
    return handleRouteError(err);
  }
}
