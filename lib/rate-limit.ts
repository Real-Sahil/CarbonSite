import { NextRequest } from "next/server";
import { apiError } from "@/lib/validation/api";

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function rateLimit(req: NextRequest, options: RateLimitOptions) {
  const now = Date.now();
  const bucketKey = `${options.key}:${clientIdentifier(req)}`;
  const bucket = buckets.get(bucketKey);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + options.windowMs });
    return null;
  }

  bucket.count += 1;
  if (bucket.count <= options.limit) return null;

  return apiError(
    "RATE_LIMITED",
    "Too many requests. Please wait and try again.",
    429,
    {
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    },
  );
}

export function rateLimitKey(orgId: string, action: string, userId?: string) {
  return ["org", orgId, action, userId ?? "anonymous"].join(":");
}

export function resetRateLimitBucketsForTests() {
  buckets.clear();
}

function clientIdentifier(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  );
}
