// Scheduled uptime monitoring job.
// Runs every 5 minutes to check the health endpoint.
// Failures are logged to Sentry and console for operator visibility.

const HEALTH_CHECK_TIMEOUT = 10000; // 10 seconds

export async function processUptimeMonitoring(): Promise<void> {
  const startTime = Date.now();

  try {
    // Construct the health check URL. In production, use the deployed URL.
    // In development, fallback to localhost.
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.HEALTH_CHECK_URL || "http://localhost:3000";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

    const response = await fetch(`${baseUrl}/api/health`, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "MetricOra-Uptime-Monitor/1.0",
      },
    });

    clearTimeout(timeoutId);

    const body = await response.json() as { ok?: boolean };
    const responseTime = Date.now() - startTime;

    // Log the check
    console.log(`[uptime-monitoring] Health check: ${response.status}, ${responseTime}ms`);

    // If health check failed or response indicates degradation
    if (response.status !== 200 || !body.ok) {
      const error = new Error(
        `Health check failed: HTTP ${response.status}, service may be down`,
      );
      console.error("[uptime-monitoring]", error);
      throw error; // Let pg-boss retry and Sentry capture
    } else if (responseTime > 5000) {
      // Log slow responses for monitoring (not a critical alert, just observability)
      console.warn(
        `[uptime-monitoring] Slow health check: ${responseTime}ms (threshold: 5000ms)`,
      );
    }
  } catch (error) {
    console.error("[uptime-monitoring] Health check error:", error);
    throw error; // Let pg-boss retry and Sentry capture
  }
}
