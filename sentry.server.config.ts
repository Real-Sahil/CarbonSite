import * as Sentry from "@sentry/nextjs";

export function initializeSentry() {
  const dsn = process.env.SENTRY_DSN;
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
    beforeSend(event, hint) {
      // Filter out non-critical errors in development
      if (process.env.NODE_ENV !== "production") {
        if (hint.originalException instanceof Error) {
          if (
            hint.originalException.message.includes("WebSocket") ||
            hint.originalException.message.includes("Connection refused")
          ) {
            return null; // Ignore these in dev
          }
        }
      }
      return event;
    },
    // Attach request context (IP, user agent) from middleware headers
    serverName: process.env.VERCEL_URL || "metricora",
    denyUrls: [
      // Ignore errors from browser extensions
      /extensions\//i,
      /^chrome:\/\//i,
      /^moz-extension:\/\//i,
    ],
  });
}
