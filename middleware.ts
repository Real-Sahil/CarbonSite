import { NextRequest, NextResponse } from "next/server";
import { rateLimit, POLICIES } from "@/lib/security/rate-limit";

// Trusted proxy IPs whose X-Forwarded-For entries we honour (FIND-008).
// Set TRUSTED_PROXY_IPS as a comma-separated list in the deployment environment.
const TRUSTED_PROXY_SET: Set<string> = new Set(
  (process.env.TRUSTED_PROXY_IPS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

function clientIp(req: NextRequest): string {
  const xForwardedFor = req.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const ips = xForwardedFor.split(",").map((s) => s.trim());
    // Walk right-to-left; skip known-trusted proxy hops, take the first
    // untrusted IP as the real client address.
    for (let i = ips.length - 1; i >= 0; i--) {
      if (!TRUSTED_PROXY_SET.has(ips[i]!)) return ips[i]!;
    }
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}

// Extract subdomain from the host header.
// Returns null for localhost, IP addresses, and the root domain.
function extractSubdomain(host: string | null): string | null {
  if (!host) return null;
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "carbonsite.app";
  const withoutPort = host.split(":")[0];

  // localhost or IP — no subdomain routing
  if (withoutPort === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(withoutPort)) {
    return null;
  }

  if (withoutPort.endsWith(`.${rootDomain}`)) {
    const sub = withoutPort.slice(0, withoutPort.length - rootDomain.length - 1);
    return sub || null;
  }

  return null;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = req.headers.get("host");

  // ── Subdomain white-label routing ──────────────────────────────────────────
  // Rewrite /<path> on a tenant subdomain to /t/<subdomain>/<path> so that
  // a separate (app)/t/[subdomain]/ segment can apply tenant branding.
  // The actual org lookup happens in that layout via the x-subdomain header.
  const subdomain = extractSubdomain(host);
  if (subdomain && !pathname.startsWith("/api/") && !pathname.startsWith("/_next/")) {
    const res = NextResponse.rewrite(
      new URL(`/t/${subdomain}${pathname}`, req.url),
    );
    res.headers.set("x-subdomain", subdomain);
    return res;
  }

  // ── Rate limiting on the abuse-prone API surfaces ──────────────────────────
  if (pathname.startsWith("/api/")) {
    const ip = clientIp(req);
    let policy: { limit: number; windowMs: number } | null = null;
    let bucket = "";

    if (pathname === "/api/auth/token") {
      // Mobile token refresh: legitimate traffic from many field workers can
      // share one site NAT IP — must not compete with the strict sign-in
      // brute-force bucket.
      policy = POLICIES.tokenRefresh;
      bucket = "token_refresh";
    } else if (pathname.startsWith("/api/auth")) {
      policy = POLICIES.auth;
      bucket = "auth";
    } else if (pathname.startsWith("/api/platform/")) {
      policy = POLICIES.read;
      bucket = "platform";
    } else if (pathname.includes("/evidence") || pathname.includes("/imports")) {
      policy = req.method === "GET" ? POLICIES.read : POLICIES.upload;
      bucket = req.method === "GET" ? "read" : "upload";
    } else if (req.method !== "GET") {
      policy = POLICIES.mutation;
      bucket = "mutation";
    } else {
      policy = POLICIES.read;
      bucket = "read";
    }

    const result = rateLimit(`${bucket}:${ip}`, policy.limit, policy.windowMs);
    if (!result.allowed) {
      return NextResponse.json(
        {
          code: "RATE_LIMITED",
          message: "Too many requests. Please slow down and retry.",
        },
        {
          status: 429,
          headers: { "Retry-After": String(result.retryAfterSeconds) },
        },
      );
    }
  }

  // ── Security headers on every response ─────────────────────────────────────
  const res = NextResponse.next();
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
  if (process.env.NODE_ENV === "production") {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|woff2?)).*)"],
};
