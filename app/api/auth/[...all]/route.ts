export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { isAccountLocked, rateLimitRequest, recordFailedLogin } from "@/lib/security/rate-limit-async";
import { POLICIES, isCredentialAuthPath } from "@/lib/security/rate-limit";

const { GET, POST: authPost } = toNextJsHandler(auth.handler);

export { GET };

// FIND-001: middleware.ts's in-memory rate limiter only bounds sign-in/
// sign-up/password-reset abuse per Vercel serverless instance — on a
// multi-instance deployment it's not a real defense. This is the persistent
// (Redis, with a Postgres fallback) layer, applied here since these routes
// are the ones brute-forceable per account/credential.
// Only credential endpoints count: sign-out, session and token calls are
// ordinary traffic. Password sign-in is also limited per account, so a
// distributed guesser cannot spread attempts across addresses.
export async function POST(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!isCredentialAuthPath(pathname)) return authPost(req);

  const limited = await rateLimitRequest(req, { key: "auth", ...POLICIES.auth });
  if (limited) return limited;

  if (pathname !== "/api/auth/sign-in/email") return authPost(req);

  const email = await req
    .clone()
    .json()
    .then((b: { email?: unknown }) => (typeof b?.email === "string" ? b.email.trim().toLowerCase() : null))
    .catch(() => null);
  if (email && (await isAccountLocked(email))) {
    return Response.json(
      { code: "ACCOUNT_LOCKED", message: "Too many failed sign-in attempts. Wait 30 minutes or reset your password." },
      { status: 429, headers: { "Retry-After": "1800" } },
    );
  }
  const res = await authPost(req);
  if (email && res.status === 401) await recordFailedLogin(email);
  return res;
}
