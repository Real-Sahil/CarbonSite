import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { getOrCreateRouteDistance } from "@/lib/geo/route-distance";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { handleRouteError } from "@/lib/validation/api";
import { routeDistanceSchema } from "@/lib/validation/org";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor", "reviewer");
    const limited = rateLimit(req, {
      key: rateLimitKey(orgId, "route-distance", session.user.id),
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;
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
