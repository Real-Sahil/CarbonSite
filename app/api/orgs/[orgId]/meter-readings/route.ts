import { NextRequest } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import { getMeterReadings } from "@/lib/iot/meter-processor";

export async function GET(
  req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const { orgId } = params;
    await requireOrgMember(orgId, "admin", "editor", "viewer");

    const searchParams = req.nextUrl.searchParams;
    const cursor = searchParams.get("cursor") || undefined;
    const deviceId = searchParams.get("deviceId") || undefined;
    const take = Math.min(parseInt(searchParams.get("take") || "50"), 100);

    const readings = await getMeterReadings(orgId, deviceId, cursor, take);

    return Response.json({
      readings,
      nextCursor: readings.length === take ? readings[readings.length - 1].id : null,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
