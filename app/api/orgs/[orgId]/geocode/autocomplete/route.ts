export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { GeocoderUnavailable, suggestAddresses } from "@/lib/geo/address";

const querySchema = z.object({
  q: z.string().trim().min(3).max(200),
  country: z.string().length(2).optional(),
});

// GET /api/orgs/[orgId]/geocode/autocomplete?q=&country=
// Address suggestions for the typed text. Members only (the key has a daily
// allowance), rate-limited, and only the text and country leave the server.
export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
    const limited = await rateLimitRequest(req, { key: rateLimitKey(orgId, "address-search", session.user.id), limit: 60, windowMs: 60_000 });
    if (limited) return limited;
    const { q, country } = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    const suggestions = await suggestAddresses(q, { country });
    return NextResponse.json({ suggestions });
  } catch (err) {
    if (err instanceof GeocoderUnavailable) {
      return apiError("GEOCODER_UNAVAILABLE", "Address search is not available. Type the address instead.", 503);
    }
    return handleRouteError(err);
  }
}
