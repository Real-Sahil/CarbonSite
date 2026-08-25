// Sentry instrumentation for error tracking and monitoring.
// This file is required by Next.js for Sentry SDK initialization.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initializeSentry } = await import("./sentry.server.config");
    initializeSentry();
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    const { initializeSentry } = await import("./sentry.edge.config");
    initializeSentry();
  }
}
