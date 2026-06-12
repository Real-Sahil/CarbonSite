import { NextRequest, NextResponse } from "next/server";
import { rateLimit, POLICIES } from "@/lib/security/rate-limit";

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Rate limiting on the abuse-prone API surfaces ──────────────────────────
  if (pathname.startsWith("/api/")) {
    const ip = clientIp(req);
    let policy: { limit: number; windowMs: number } | null = null;
    let bucket = "";

    if (pathname.startsWith("/api/auth")) {
      policy = POLICIES.auth;
      bucket = "auth";
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
  // Everything except static assets and Next.js internals
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|woff2?)).*)"],
};
