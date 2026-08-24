import type { NextRequest } from "next/server";

const TRUSTED_PROXY_SET: Set<string> = new Set(
  (process.env.TRUSTED_PROXY_IPS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

// Walk X-Forwarded-For right-to-left, skip trusted proxies (FIND-008).
export function resolveClientIp(req: NextRequest): string {
  const xForwardedFor = req.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const ips = xForwardedFor.split(",").map((s) => s.trim());
    for (let i = ips.length - 1; i >= 0; i--) {
      if (!TRUSTED_PROXY_SET.has(ips[i]!)) return ips[i]!;
    }
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}
