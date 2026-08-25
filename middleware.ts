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
  try {
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

    // Forward the resolved (proxy-aware) client IP so route handlers — and
    // writeAuditLog() in particular — don't need to re-derive it or thread it
    // through every call site. The raw X-Forwarded-For header is untrustworthy
    // on its own; this is the value that already walked past trusted proxies.
    requestHeaders.set("x-client-ip", resolveClientIp(req));

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

    // ── Content Security Policy ─────────────────────────────────────────────────
    // Simplified CSP to ensure JavaScript and event handlers work properly.
    // Using 'unsafe-inline' for scripts and styles since the app uses React with inline handlers.
    const cspHeader = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://analytics.google.com https://www.googletagmanager.com", // Allow inline scripts for React event handlers
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // unsafe-inline: Tailwind + shadcn; Google Fonts
      "img-src 'self' data: blob: https://*.r2.cloudflarestorage.com https://images.unsplash.com https://lh3.googleusercontent.com https://avatars.githubusercontent.com",
      "connect-src 'self' https://*.r2.cloudflarestorage.com https://api.postcodes.io https://api.github.com",
      "font-src 'self' https://fonts.gstatic.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; ");

    // ── Security headers on every response ─────────────────────────────────────
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set("Content-Security-Policy", cspHeader);
    res.headers.set("X-Frame-Options", "DENY");
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    res.headers.set(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=()",
    );
    res.headers.set("X-DNS-Prefetch-Control", "off");
    res.headers.set("X-Permitted-Cross-Domain-Policies", "none");
    res.headers.set("Cross-Origin-Opener-Policy", "same-origin");

    if (process.env.NODE_ENV === "production") {
      res.headers.set(
        "Strict-Transport-Security",
        "max-age=63072000; includeSubDomains; preload",
      );
    }
    return res;
  } catch (error) {
    // Fail open: if middleware crashes, continue without security headers
    // rather than blocking all traffic
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|woff2?)).*)"],
};
