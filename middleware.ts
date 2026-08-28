import { NextRequest, NextResponse } from "next/server";
import { rateLimit, POLICIES } from "@/lib/security/rate-limit";
import { resolveClientIp } from "@/lib/security/client-ip";

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
  // Pass the tenant subdomain as a request header so server components can
  // read it via headers().get("x-subdomain") and apply the org's branding.
  // No path rewrite — the URL structure stays identical on subdomain hosts.
  const subdomain = extractSubdomain(host);
  const requestHeaders = new Headers(req.headers);
  if (subdomain) {
    requestHeaders.set("x-subdomain", subdomain);
  }

  // ── Rate limiting on the abuse-prone API surfaces ──────────────────────────
  if (pathname.startsWith("/api/")) {
    const ip = resolveClientIp(req);
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
  const res = NextResponse.next({ request: { headers: requestHeaders } });
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
