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
      select: { id: true, expiresAt: true, revokedAt: true, userId: true },
    });
    if (!session) {
      return apiError("UNAUTHENTICATED", "Session not found.", 401);
    }

    const now = Date.now();
    if (session.revokedAt || session.expiresAt.getTime() <= now) {
      return apiError("SESSION_EXPIRED", "Session expired. Ask your organisation for a new invite link.", 401);
    }

    const newToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(now + SESSION_TTL_MS);
    await prisma.session.update({
      where: { id: session.id },
      data: { token: newToken, expiresAt },
    });

    return NextResponse.json({ token: newToken, expiresAt: expiresAt.toISOString() });
  } catch (err) {
    return handleRouteError(err);
  }
}
