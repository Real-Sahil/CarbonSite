export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";

type Params = { params: Promise<{ orgId: string; instrumentId: string }> };

// DELETE /api/orgs/[orgId]/energy-instruments/[instrumentId]
// Past calculation runs keep the figures they were calculated with; only new
// runs stop using a deleted instrument.
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, instrumentId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);

    const instrument = await prisma.energyInstrument.findFirst({
      where: { id: instrumentId, organizationId: orgId },
    });
    if (!instrument) return apiError("NOT_FOUND", "Instrument not found.", 404);

    await prisma.energyInstrument.delete({ where: { id: instrument.id } });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "energy_instrument.deleted",
      resourceType: "energy_instrument",
      resourceId: instrument.id,
      metadata: { type: instrument.type, reference: instrument.reference },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
