export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { handleRouteError } from "@/lib/validation/api";
import { companiesReply } from "@/lib/geo/companies-lookup";

// GET /api/companies?q= | ?number=  The same lookup for a signed-in person who has no organisation yet (sign-up).
export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const limited = await rateLimitRequest(req, { key: `companies-lookup:${session.user.id}`, limit: 20, windowMs: 60_000 });
    if (limited) return limited;
    return await companiesReply(req.nextUrl.searchParams);
  } catch (err) {
    return handleRouteError(err);
  }
}
