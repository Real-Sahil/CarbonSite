// Browser error tracking. Loaded by Next.js before the app hydrates.
// Kept deliberately small: no session replay, light tracing. The DSN is the
// server's SENTRY_DSN, exposed at build time by next.config.ts (a DSN is
// public by design; it only allows sending events).
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    enabled: process.env.NODE_ENV === "production",
    tracesSampleRate: 0.05,
    sendDefaultPii: false,
    denyUrls: [/extensions\//i, /^chrome:\/\//i, /^moz-extension:\/\//i, /^safari-extension:\/\//i],
    ignoreErrors: [
      // Benign browser noise
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      // A deploy replaced the chunk this tab was built against; a reload fixes it.
      /Loading chunk [\d]+ failed/,
      /ChunkLoadError/,
      // A fetch cut off by the network or by the tab going to the background
      // (Safari/iOS "Load failed", Chrome "Failed to fetch", Firefox
      // "NetworkError ..."). Nothing to fix server-side; pages show a retry.
      /^(TypeError: )?(Load failed|Failed to fetch|NetworkError when attempting to fetch resource\.)$/,
    ],
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
