// Sentry instrumentation for error tracking and monitoring.
// This file is required by Next.js for Sentry SDK initialization.
// Edge runtime (middleware) is excluded to keep the middleware Edge Function under Vercel's 1 MB limit.
// Middleware is deterministic (rate limiting, CSP generation) and doesn't need error instrumentation.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initializeSentry } = await import("./sentry.server.config");
    initializeSentry();
  }

  // Edge runtime (middleware) intentionally skipped—see next.config.ts comment for rationale
}
