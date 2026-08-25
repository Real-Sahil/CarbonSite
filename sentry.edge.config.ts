import * as Sentry from "@sentry/nextjs";

export function initializeSentry() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;
  if (!dsn) {
    console.warn("SENTRY_DSN not set. Sentry error tracking is disabled.");
    return;
  }

  Sentry.init({
    dsn,
    enabled: process.env.NODE_ENV === "production" || process.env.SENTRY_ENABLED === "true",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    debug: process.env.NODE_ENV !== "production",
    environment: process.env.NODE_ENV || "development",
  });
}
