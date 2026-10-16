export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { POLICIES } from "@/lib/security/rate-limit";

// POST /api/auth/token — mobile bearer-token refresh.
//
// Field workers authenticate with a session token stored on-device; they have
// no password (invite links are single-use). The Dio interceptor calls this
// endpoint on 401. We rotate the token and extend the session only while it is
// unexpired and unrevoked; an expired session needs a new invite link.

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, matches accept-invite
// Absolute cap from sign-in. Refreshing slides the expiry, so without this a token copied off a lost device never ends.
const SESSION_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

function extractBearerToken(header: string | null): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimitRequest(req, { key: "token_refresh", ...POLICIES.tokenRefresh });
    if (limited) return limited;

    const token = extractBearerToken(req.headers.get("authorization"));
    if (!token) {
      return apiError("UNAUTHENTICATED", "Missing bearer token.", 401);
    }

    const session = await prisma.session.findUnique({
      where: { token },
      select: { id: true, createdAt: true, expiresAt: true, revokedAt: true, userId: true },
    });
    if (!session) {
      return apiError("UNAUTHENTICATED", "Session not found.", 401);
    }

    const now = Date.now();
    const absoluteExpiry = session.createdAt.getTime() + SESSION_MAX_AGE_MS;
    if (session.revokedAt || session.expiresAt.getTime() <= now || absoluteExpiry <= now) {
      return apiError("SESSION_EXPIRED", "Session expired. Ask your organisation for a new invite link.", 401);
    }

    // Conditional on the old token and no revocation: two refreshes racing on one token cannot both rotate it.
    const newToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Math.min(now + SESSION_TTL_MS, absoluteExpiry));
    const rotated = await prisma.session.updateMany({
      where: { id: session.id, token, revokedAt: null },
      data: { token: newToken, expiresAt },
    });
    if (rotated.count === 0) {
      return apiError("UNAUTHENTICATED", "Session not found.", 401);
    }

    return NextResponse.json({ token: newToken, expiresAt: expiresAt.toISOString() });
  } catch (err) {
    return handleRouteError(err);
  }
}
