import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { getOrCreateRouteDistance } from "@/lib/geo/route-distance";
import { handleRouteError } from "@/lib/validation/api";
import { routeDistanceSchema } from "@/lib/validation/org";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer");
    const body = routeDistanceSchema.parse(await req.json());

    const result = await getOrCreateRouteDistance({
      organizationId: orgId,
      pickupPostcode: body.pickupPostcode,
      deliveryPostcode: body.deliveryPostcode,
    });

    return NextResponse.json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
