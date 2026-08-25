import { NextResponse } from "next/server";
import { getMetricsText } from "@/lib/observability/metrics";

export const dynamic = "force-dynamic";

/**
 * Prometheus-compatible metrics endpoint
 * Exports metrics in text format for Prometheus scraping
 * Usage: Configure Prometheus to scrape https://yourdomain.com/api/metrics
 */
export async function GET() {
  const metricsText = getMetricsText();

  return new NextResponse(metricsText, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
    },
  });
}
