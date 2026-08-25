// Sentry instrumentation for error tracking and monitoring.
// This file is required by Next.js for Sentry SDK initialization.
// Edge runtime (middleware) is excluded to keep the middleware Edge Function under Vercel's 1 MB limit.
// Middleware is deterministic (rate limiting, CSP generation) and doesn't need error instrumentation.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initializeSentry } = await import("./sentry.server.config");
    initializeSentry();
  }

  // Edge Runtime middleware doesn't need Sentry instrumentation.
  // Middleware is deterministic (rate limiting, CSP nonce generation) and doesn't involve
  // business logic that would benefit from error tracking. Skipping Sentry here keeps
  // the Edge Function size under 1 MB limit.
}
