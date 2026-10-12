export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { recordOpened, resolveSubcontractorToken } from "@/lib/subcontractor/portal";
import { apiError, handleRouteError } from "@/lib/validation/api";

/**
 * Called by the form once it has loaded in a browser, so the first-opened time is not
 * set by link scanners that fetch the page without running it.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const limited = await rateLimitRequest(req, {
      key: `subcontractor-open:${token.slice(0, 16)}`,
      limit: 10,
      windowMs: 60 * 60_000,
    });
    if (limited) return limited;

    const row = await resolveSubcontractorToken(token);
    if (!row) return apiError("NOT_FOUND", "This link has expired or been withdrawn. Ask for a new one.", 404);

    await recordOpened(row.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
