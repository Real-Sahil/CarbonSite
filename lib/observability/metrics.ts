/**
 * Metrics collection for CarbonSite
 * Emits metrics as JSON logs for ingestion by Grafana Loki and Prometheus.
 * Metrics are tagged with labels for easy filtering and aggregation.
 */

interface Metric {
  type: "counter" | "histogram" | "gauge";
  name: string;
  value: number;
  labels: Record<string, string>;
  timestamp: string;
}

const metrics: Metric[] = [];

/**
 * Emit a metric to the metrics collection
 */
function emitMetric(
  type: "counter" | "histogram" | "gauge",
  name: string,
  value: number,
  labels: Record<string, string>
): void {
  const metric: Metric = {
    type,
    name,
    value,
    labels,
    timestamp: new Date().toISOString(),
  };

  // Log as JSON for Loki ingestion
  console.log(JSON.stringify({ metric, _type: "metric" }));

  // Keep in memory for /metrics endpoint
  metrics.push(metric);
  if (metrics.length > 10000) {
    metrics.shift(); // Keep memory bounded
  }
}

/**
 * Record API request metrics
 */
export function recordApiRequest(
  method: string,
  path: string,
  statusCode: number,
  durationMs: number
): void {
  const labels = {
    method,
    path: sanitizePath(path),
    status: String(statusCode),
  };

  // Counter: total requests
  emitMetric("counter", "api_requests_total", 1, labels);

  // Histogram: request latency
  emitMetric("histogram", "api_request_duration_ms", durationMs, labels);

  // Counter: errors
  if (statusCode >= 400) {
    emitMetric("counter", "api_errors_total", 1, labels);
  }
}

/**
 * Record job processing metrics
 */
export function recordJobProcessed(
  queue: string,
  status: "success" | "failure",
  durationMs: number
): void {
  const labels = { queue, status };

  if (status === "success") {
    emitMetric("counter", "jobs_processed_total", 1, labels);
  } else {
    emitMetric("counter", "jobs_failed_total", 1, labels);
  }

  emitMetric("histogram", "job_processing_duration_ms", durationMs, labels);
}

/**
 * Record authentication metrics
 */
export function recordAuthAttempt(method: string, success: boolean): void {
  const labels = { method };
  const metric = success ? "auth_success_total" : "auth_failure_total";
  emitMetric("counter", metric, 1, labels);
}

/**
 * Update active jobs gauge
 */
export function setActiveJobs(queue: string, count: number): void {
  emitMetric("gauge", "jobs_active", count, { queue });
}

/**
 * Update queued jobs gauge
 */
export function setQueuedJobs(queue: string, count: number): void {
  emitMetric("gauge", "jobs_queued", count, { queue });
}

/**
 * Record database query metrics
 */
export function recordDatabaseQuery(
  query: string,
  durationMs: number,
  success: boolean
): void {
  const labels = {
    query: sanitizeQuery(query),
    success: String(success),
  };

  emitMetric("histogram", "database_query_duration_ms", durationMs, labels);
}

/**
 * Get Prometheus-compatible metrics in text format
 * Used by /metrics endpoint for Prometheus scraping
 */
export function getMetricsText(): string {
  const lines: string[] = [];

  for (const metric of metrics) {
    const labels = Object.entries(metric.labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(",");

    const metricName = `carbonsite_${metric.name}`;
    const line = `${metricName}{${labels}} ${metric.value}`;
    lines.push(line);
  }

  return lines.join("\n");
}

/**
 * Sanitize API paths to avoid high cardinality
 * e.g., /orgs/123/records/456 → /orgs/:id/records/:id
 */
function sanitizePath(path: string): string {
  return path
    .replace(/\/[a-z0-9]{20,}/gi, "/:id") // Replace long IDs (cuid format)
    .replace(/\/\d+/g, "/:id"); // Replace numeric IDs
}

/**
 * Sanitize SQL queries to avoid high cardinality
 * e.g., "SELECT * FROM users WHERE id = '123'" → "SELECT * FROM users"
 */
function sanitizeQuery(query: string): string {
  return query
    .replace(/WHERE.*$/i, "") // Remove WHERE clause
    .replace(/VALUES.*$/i, "") // Remove VALUES clause
    .trim();
}
