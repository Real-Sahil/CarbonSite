import type { NextConfig } from "next";

// Security headers are now generated dynamically in middleware.ts with CSP nonces.
// See middleware.ts for the CSP header generation logic (nonce per request).
// This config file only handles non-CSP headers.

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

export default nextConfig;
