export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { suggestSubregion } from "@/lib/calculation/egrid-locate";
import { handleRouteError } from "@/lib/validation/api";

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

// GET /api/orgs/[orgId]/egrid-subregion?lat=&lon=
// The eGRID subregion suggested for a position (nearest plants, local data;
// nothing leaves the server). Editors only, like the facility form it serves.
export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
    const { lat, lon } = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    return NextResponse.json({ suggestion: suggestSubregion(lat, lon) });
  } catch (err) {
    return handleRouteError(err);
  }
}
