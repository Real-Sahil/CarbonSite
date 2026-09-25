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
    // Vercel holds the key as STRIPE_PUBLISHABLE_KEY; the card form reads the public name.
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? process.env.STRIPE_PUBLISHABLE_KEY ?? "",
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV ?? "",
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? "",
  },
  // Source maps are built only when they will be uploaded to Sentry, and
  // scripts/upload-sourcemaps.mjs deletes them from the output afterwards so
  // the original source is never served publicly.
  productionBrowserSourceMaps: Boolean(process.env.SENTRY_AUTH_TOKEN),
  // chromium-min ships no binaries — it downloads from a CDN URL at runtime into /tmp.
  // This keeps Lambda well under Vercel's 50 MB limit. No outputFileTracingIncludes needed.
  // Bill and PDF reading runs OCR on the server: ship Tesseract's worker, its
  // WASM core and the English data with the routes that use them (loaded by
  // path at run time, so file tracing cannot see them).
  outputFileTracingIncludes: {
    "/api/orgs/[orgId]/evidence/bill": [
      "./node_modules/tesseract.js/**/*",
      "./node_modules/tesseract.js-core/**/*",
      "./node_modules/@tesseract.js-data/eng/4.0.0_best_int/**/*",
      "./node_modules/@tesseract.js-data/eng/package.json",
    ],
    "/api/orgs/[orgId]/imports/**/*": [
      "./node_modules/tesseract.js/**/*",
      "./node_modules/tesseract.js-core/**/*",
      "./node_modules/@tesseract.js-data/eng/4.0.0_best_int/**/*",
      "./node_modules/@tesseract.js-data/eng/package.json",
    ],
  },
  serverExternalPackages: ["@sparticuz/chromium-min", "puppeteer-core", "puppeteer", "pdfkit", "sharp", "pdf-parse", "tesseract.js"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push("@sparticuz/chromium-min", "puppeteer", "puppeteer-core", "sharp", "pdf-parse", "tesseract.js");
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
  // Old marketing URLs that were removed or renamed, and links still in the
  // wild (old blog slugs, the comparison and case study pages).
  async redirects() {
    const oldPosts = [
      "anomaly-detection-carbon-data", "anomaly-detection-carbon", "audit-immutability-architecture", "audit-immutability-carbon",
      "building-for-audit-immutability", "building-for-audit", "carbon-accounting-at-scale", "carbon-accounting-scale-dashboard",
      "data-journey-field-to-finance", "emissions-data-journey", "field-workers-carbon-accounting", "open-source-carbon-accounting",
      "open-source-transparency", "performance-at-scale", "scope-3-emissions-supplier-data", "scope3-from-silence-to-data",
      "scope3-supplier-collaboration", "supplier-carbon-data-wrong", "supplier-data-quality-fix", "why-carbon-accounting-fails",
      "why-carbon-accounting-still-fails",
    ];
    return [
      { source: "/calculation", destination: "/methodology", permanent: true },
      { source: "/comparison", destination: "/pricing", permanent: true },
      { source: "/public/comparison", destination: "/pricing", permanent: true },
      { source: "/case-studies", destination: "/contact", permanent: true },
      { source: "/case-studies/:slug*", destination: "/contact", permanent: true },
      { source: "/demo", destination: "/contact", permanent: true },
      { source: "/start", destination: "/sign-up", permanent: true },
      { source: "/about", destination: "/contact", permanent: true },
      { source: "/features", destination: "/product", permanent: true },
      { source: "/solutions/field-app", destination: "/field-app", permanent: true },
      { source: "/solutions/supply-chain", destination: "/product#operations", permanent: true },
      { source: "/docs/:path*", destination: "/developer", permanent: true },
      ...oldPosts.map((slug) => ({ source: `/blog/${slug}`, destination: "/blog", permanent: true })),
    ];
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
