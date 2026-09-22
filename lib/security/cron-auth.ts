import { timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Accepts the secret as `x-cron-secret`, `Authorization: Bearer` (what Vercel
 * Crons send) or, for older external schedulers, `?secret=`. Either
 * SCHEDULER_SECRET (used by the Supabase pg_cron schedule) or CRON_SECRET
 * authorises the call.
 */
export function isAuthorizedCronRequest(req: NextRequest): boolean {
  const bearer = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const provided =
    req.headers.get("x-cron-secret") ?? bearer ?? req.nextUrl.searchParams.get("secret");
  if (!provided) return false;

  const accepted = [process.env.SCHEDULER_SECRET, process.env.CRON_SECRET].filter(
    (s): s is string => typeof s === "string" && s.length >= 16,
  );
  return accepted.some((secret) => safeEqual(provided, secret));
}
