export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";

type Params = { params: Promise<{ orgId: string; priceId: string }> };

// DELETE /api/orgs/[orgId]/carbon-prices/[priceId]
// Nothing stores a price by reference, so a deleted price only stops showing
// in appraisals from now on. The audit log keeps what it was.
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, priceId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);

    const price = await prisma.internalCarbonPrice.findFirst({ where: { id: priceId, organizationId: orgId } });
    if (!price) return apiError("NOT_FOUND", "Carbon price not found.", 404);

    await prisma.internalCarbonPrice.delete({ where: { id: price.id } });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "carbon_price.deleted",
      resourceType: "InternalCarbonPrice",
      resourceId: price.id,
      metadata: {
        name: price.name,
        priceType: price.priceType,
        pricePerTonne: Number(price.pricePerTonne),
        currency: price.currency,
        effectiveFrom: price.effectiveFrom.toISOString().slice(0, 10),
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
