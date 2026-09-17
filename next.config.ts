import type { NextConfig } from "next";

// Security headers are now generated dynamically in middleware.ts with CSP nonces.
// See middleware.ts for the CSP header generation logic (nonce per request).
// This config file only handles non-CSP headers.
//
// NOTE: Sentry wrapper removed from this config because it adds ~1.06 MB to the
// middleware Edge Function bundle, exceeding Vercel's 1 MB free tier limit.
// Middleware doesn't need instrumentation (it's deterministic: rate limiting,
// CSP generation). Error tracking is handled manually in API routes via
// Sentry.captureException() calls instead.

const nextConfig: NextConfig = {
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core", "puppeteer", "pdfkit", "sharp"],
  // Force Vercel's file tracer to include @sparticuz/chromium binary files (.br compressed).
  // Without this, the bin/ directory is excluded from the Lambda deployment package and
  // @sparticuz/chromium fails with "input directory does not exist" at runtime.
  outputFileTracingIncludes: {
    "/api/**": [
      "./node_modules/@sparticuz/chromium/**",
      "./node_modules/@sparticuz/chromium/bin/**",
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push("@sparticuz/chromium", "puppeteer", "puppeteer-core", "sharp");
    }
    return config;
  },
  // Turbopack is enabled by default in Next.js 16. serverExternalPackages (line 14) applies to both webpack and Turbopack.
  // Turbopack respects serverExternalPackages; webpack uses explicit externals config (line 15-21).
  turbopack: {},
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
    ],
  },
  async headers() {
    return [
      // Prevent browser and CDN caching of all API routes.
      // Without this, prefetch or repeated requests can serve stale data and
      // cause "database is updating" false positives when mutations haven't
      // propagated to a cached response.
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
    ];
  },
};

export default nextConfig;
