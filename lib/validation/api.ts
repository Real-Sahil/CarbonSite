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

export function handleRouteError(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return apiError(err.code, err.message, err.status);
  }
  if (isStripeError(err)) {
    const sanitizedMessage = sanitizeStripeErrorMessage(err.message);
    return apiError("STRIPE_ERROR", sanitizedMessage, err.status || 400);
  }
  if (isStructuredApiError(err)) {
    return apiError(err.code, err.message, err.status, err.details);
  }
  if (err instanceof ZodError) {
    return apiError("VALIDATION_ERROR", "Invalid request data", 422, err.flatten());
  }
  console.error(err);
  return apiError("INTERNAL_ERROR", "An unexpected error occurred", 500);
}

function isStripeError(err: unknown): err is { message: string; status?: number; type?: string } {
  if (!err || typeof err !== "object") return false;
  const candidate = err as { type?: unknown; message?: unknown };
  return typeof candidate.type === "string" && candidate.type.startsWith("StripeInvalid");
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
