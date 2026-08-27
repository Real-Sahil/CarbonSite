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
  if (isStructuredApiError(err)) {
    return apiError(err.code, err.message, err.status, err.details);
  }
  if (err instanceof ZodError) {
    return apiError("VALIDATION_ERROR", "Invalid request data", 422, err.flatten());
  }
  if (isStripeError(err)) {
    const status = (err as any).statusCode || 400;
    const code = (err as any).code || "STRIPE_ERROR";
    const errorCode = `STRIPE_${code}`;
    console.error("Stripe error:", { code: errorCode, message: err.message, status });
    return apiError(errorCode, err.message, status);
  }
  if (err instanceof Error) {
    console.error("Route error:", err.message, err);
    return apiError("INTERNAL_ERROR", err.message || "An unexpected error occurred", 500);
  }
  console.error("Unknown route error:", err);
  return apiError("INTERNAL_ERROR", "An unexpected error occurred", 500);
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
