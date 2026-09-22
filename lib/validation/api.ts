import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth/session";

export type ApiError = {
  code: string;
  message: string;
  details?: unknown;
};

export function apiError(code: string, message: string, status: number, details?: unknown): NextResponse {
  return NextResponse.json({ code, message, details } satisfies ApiError, { status });
}

function isStripeError(err: unknown): err is { type?: string; code?: string; message: string; statusCode?: number; param?: string } {
  return !!(err && typeof err === "object" && ("type" in err || "statusCode" in err) && "message" in err);
}

export function handleRouteError(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return apiError(err.code, err.message, err.status);
  }
  if (isStripeError(err)) {
    const sanitizedMessage = sanitizeStripeErrorMessage(err.message);
    const status = err.statusCode || 400;
    const code = err.code || "STRIPE_ERROR";
    const errorCode = `STRIPE_${code}`;
    return apiError(errorCode, sanitizedMessage, status);
  }
  if (isStructuredApiError(err)) {
    return apiError(err.code, err.message, err.status, err.details);
  }
  if (err instanceof ZodError) {
    return apiError("VALIDATION_ERROR", "Invalid request data", 422, err.flatten());
  }
  // Anything reaching here is unexpected: report it, since returning a 500
  // swallows the error before Sentry's request instrumentation can see it.
  // The client gets a generic message and the Sentry event ID, never the raw
  // error, which can carry database or implementation details.
  const eventId = Sentry.captureException(err);
  console.error("Route error:", err);
  return apiError(
    "INTERNAL_ERROR",
    "Something went wrong on our side. Please try again, or quote the reference if it keeps happening.",
    500,
    eventId ? { reference: eventId } : undefined,
  );
}

function sanitizeStripeErrorMessage(message: string): string {
  if (!message) return "Payment processing failed";
  const apiKeyPattern = /sk_(test|live)_[a-zA-Z0-9]{24,}/g;
  const sanitized = message.replace(apiKeyPattern, "[API_KEY_REDACTED]");
  return sanitized || "Payment processing failed";
}

function isStructuredApiError(
  err: unknown,
): err is { code: string; message: string; status: number; details?: unknown } {
  if (!err || typeof err !== "object") return false;
  const candidate = err as { code?: unknown; message?: unknown; status?: unknown };
  return (
    typeof candidate.code === "string" &&
    typeof candidate.message === "string" &&
    typeof candidate.status === "number" &&
    candidate.status >= 400 &&
    candidate.status < 600
  );
}
