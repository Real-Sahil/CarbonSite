import { NextRequest, NextResponse } from "next/server";
import { getMetricsText } from "@/lib/observability/metrics";

export const dynamic = "force-dynamic";

/**
 * Prometheus-compatible metrics endpoint.
 * Protected by bearer token: set METRICS_SECRET env var and configure
 * your Prometheus scrape job with Authorization: Bearer <secret>.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.METRICS_SECRET;
  const auth = req.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const metricsText = getMetricsText();

  return new NextResponse(metricsText, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
    },
  });
}
