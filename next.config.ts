import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Security headers are now generated dynamically in middleware.ts with CSP nonces.
// See middleware.ts for the CSP header generation logic (nonce per request).
// This config file only handles non-CSP headers and Sentry integration.

const nextConfig: NextConfig = {
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core", "puppeteer", "pdfkit"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
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

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  org: process.env.SENTRY_ORG || "carbonsite",
  project: process.env.SENTRY_PROJECT || "next-js",

  // Only print logs for uploading source maps related errors
  silent: true,

  // Transpile SDK to ensure compatibility
  widenClientFileUpload: true,

  // Hides source maps from generated client bundles
  sourcemaps: {
    disable: true,
  },

  // Disable tunnelRoute to reduce Edge Function bundle size (less critical for free tier)
  // Browser errors will report directly to Sentry instead of through a proxy
  tunnelRoute: undefined,
});
