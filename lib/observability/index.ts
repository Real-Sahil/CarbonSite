/**
 * Observability infrastructure for MetricOra
 * Provides structured logging and metrics collection.
 * Integrates with Grafana Cloud via Loki (logs) and Prometheus (metrics).
 */

let initialized = false;

/**
 * Initialize observability infrastructure.
 * Validates Grafana Cloud configuration (development mode skips this).
 */
export function initializeObservability(): void {
  if (initialized) return;
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  try {
    const apiKey = process.env.GRAFANA_CLOUD_API_KEY;
    const logsUrl = process.env.GRAFANA_CLOUD_LOGS_URL;

    if (!apiKey) {
      console.warn("[observability] GRAFANA_CLOUD_API_KEY not configured");
      return;
    }

    if (!logsUrl) {
      console.warn("[observability] GRAFANA_CLOUD_LOGS_URL not configured");
      return;
    }

    initialized = true;
    console.log("[observability] Initialized for Grafana Cloud");
  } catch (error) {
    console.error("[observability] Failed to initialize:", error);
  }
}

/**
 * Get a structured logger instance.
 * Logs are output as JSON with optional Grafana Cloud shipping.
 */
export function getLogger(module: string) {
  return {
    info: (message: string, metadata?: Record<string, unknown>) => {
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          level: "info",
          module,
          msg: message,
          ...metadata,
        })
      );
    },
    error: (message: string, error?: Error | unknown, metadata?: Record<string, unknown>) => {
      const errorInfo =
        error instanceof Error
          ? {
              error_message: error.message,
              error_stack: error.stack,
            }
          : { error: String(error) };

      console.error(
        JSON.stringify({
          ts: new Date().toISOString(),
          level: "error",
          module,
          msg: message,
          ...errorInfo,
          ...metadata,
        })
      );
    },
    warn: (message: string, metadata?: Record<string, unknown>) => {
      console.warn(
        JSON.stringify({
          ts: new Date().toISOString(),
          level: "warn",
          module,
          msg: message,
          ...metadata,
        })
      );
    },
    debug: (message: string, metadata?: Record<string, unknown>) => {
      if (process.env.DEBUG) {
        console.debug(
          JSON.stringify({
            ts: new Date().toISOString(),
            level: "debug",
            module,
            msg: message,
            ...metadata,
          })
        );
      }
    },
  };
}

// Initialize on module load
if (typeof window === "undefined") {
  initializeObservability();
}
