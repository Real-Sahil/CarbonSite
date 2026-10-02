export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { DEFAULT_RADIUS_MILES, MAX_RADIUS_MILES } from "@/lib/social-value/local-spend";
import { loadLocalSpend } from "@/lib/social-value/local-spend-load";

const query = z.object({
  siteId: z.string().min(1),
  radiusMiles: z.coerce.number().positive().max(MAX_RADIUS_MILES).default(DEFAULT_RADIUS_MILES),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

/** Share of a site's supplier spend that went to local businesses and SMEs. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders, "contract_manager");
    const q = query.parse(Object.fromEntries(new URL(req.url).searchParams));

    const result = await loadLocalSpend(orgId, {
      siteId: q.siteId,
      radiusMiles: q.radiusMiles,
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
    });
    if (!result.ok) {
      return apiError(result.code === "SITE_NOT_FOUND" ? "NOT_FOUND" : "UNPROCESSABLE", result.message, result.code === "SITE_NOT_FOUND" ? 404 : 422);
    }
    return NextResponse.json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
