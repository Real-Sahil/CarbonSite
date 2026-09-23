import type { NextConfig } from "next";

// Security headers are now generated dynamically in middleware.ts with CSP nonces.
// See middleware.ts for the CSP header generation logic (nonce per request).
// This config file only handles non-CSP headers.
//
// NOTE: the withSentryConfig wrapper is deliberately not used: it adds ~1.06 MB
// to the middleware Edge Function bundle, exceeding Vercel's 1 MB free tier
// limit. Server errors are reported from instrumentation.ts and
// handleRouteError(), browser errors from instrumentation-client.ts, and
// source maps are uploaded after the build by scripts/upload-sourcemaps.mjs.

const nextConfig: NextConfig = {
  // Browser Sentry (instrumentation-client.ts) reuses the server DSN.
  env: {
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN ?? "",
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV ?? "",
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? "",
  },
  // Source maps are built only when they will be uploaded to Sentry, and
  // scripts/upload-sourcemaps.mjs deletes them from the output afterwards so
  // the original source is never served publicly.
  productionBrowserSourceMaps: Boolean(process.env.SENTRY_AUTH_TOKEN),
  // chromium-min ships no binaries — it downloads from a CDN URL at runtime into /tmp.
  // This keeps Lambda well under Vercel's 50 MB limit. No outputFileTracingIncludes needed.
  serverExternalPackages: ["@sparticuz/chromium-min", "puppeteer-core", "puppeteer", "pdfkit", "sharp"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push("@sparticuz/chromium-min", "puppeteer", "puppeteer-core", "sharp");
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
