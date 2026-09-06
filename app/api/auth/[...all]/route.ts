export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { POLICIES } from "@/lib/security/rate-limit";

const { GET, POST: authPost } = toNextJsHandler(auth.handler);

export { GET };

// FIND-001: middleware.ts's in-memory rate limiter only bounds sign-in/
// sign-up/password-reset abuse per Vercel serverless instance — on a
// multi-instance deployment it's not a real defense. This is the persistent
// (Redis, with a Postgres fallback) layer, applied here since these routes
// are the ones brute-forceable per account/credential.
export async function POST(req: NextRequest) {
  const limited = await rateLimitRequest(req, { key: "auth", ...POLICIES.auth });
  if (limited) return limited;
  return authPost(req);
}
