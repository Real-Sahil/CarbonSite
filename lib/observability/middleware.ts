import { NextRequest, NextResponse } from "next/server";
import { recordApiRequest } from "./metrics";

/**
 * Wrap a route handler to record metrics automatically
 */
export function withObservability<T extends Record<string, unknown>>(
  handler: (req: NextRequest, context: T) => Promise<NextResponse>
) {
  return async (req: NextRequest, context: T): Promise<NextResponse> => {
    const startTime = Date.now();
    const method = req.method;
    const path = req.nextUrl.pathname;

    try {
      const response = await handler(req, context);
      const durationMs = Date.now() - startTime;
      const statusCode = response.status;

      recordApiRequest(method, path, statusCode, durationMs);

      // Add observability headers for debugging
      const newResponse = new NextResponse(response.body, response);
      newResponse.headers.set("x-response-time-ms", String(durationMs));
      newResponse.headers.set("x-trace-id", generateTraceId());

      return newResponse;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      recordApiRequest(method, path, 500, durationMs);
      throw error;
    }
  };
}

/**
 * Generate a unique trace ID for request tracking
 */
export function generateTraceId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Get or create a trace ID from headers
 */
export function getOrCreateTraceId(headers: Headers): string {
  const existing = headers.get("x-trace-id");
  return existing || generateTraceId();
}
