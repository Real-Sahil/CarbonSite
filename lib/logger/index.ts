// Structured logging abstraction for production use.
// Logs flow to stdout/stderr and are captured by deployment platforms (Vercel, etc).
// For local development, logs appear in console. For production, they're indexed by logging services.

import * as Sentry from "@sentry/nextjs";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogContext = Record<string, unknown>;

class Logger {
  private context: LogContext = {};

  constructor(namespace: string) {
    this.context = { namespace };
  }

  private formatMessage(level: LogLevel, message: string, ctx?: LogContext): void {
    const timestamp = new Date().toISOString();
    const combined = ctx ? { ...this.context, ...ctx } : this.context;

    const formatted = `[${timestamp}] [${level.toUpperCase()}] [${combined.namespace || "app"}] ${message}`;

    // Log to console based on level
    switch (level) {
      case "debug":
      case "info":
        console.log(formatted, ctx ? ctx : "");
        break;
      case "warn":
        console.warn(formatted, ctx ? ctx : "");
        break;
      case "error":
        console.error(formatted, ctx ? ctx : "");
        break;
    }

    // Send to Sentry for error/warn levels in production
    if (process.env.SENTRY_DSN && (level === "error" || level === "warn")) {
      try {
        if (level === "error") {
          Sentry.captureMessage(message, "error");
        } else {
          Sentry.captureMessage(message, "warning");
        }

        if (Object.keys(combined).length > 0) {
          Sentry.setContext("structured_log", combined);
        }
      } catch {
        // Sentry not available, continue
      }
    }
  }

  debug(message: string, context?: LogContext): void {
    this.formatMessage("debug", message, context);
  }

  info(message: string, context?: LogContext): void {
    this.formatMessage("info", message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.formatMessage("warn", message, context);
  }

  error(message: string, context?: LogContext): void {
    this.formatMessage("error", message, context);
  }

  withContext(ctx: LogContext): Logger {
    const logger = new Logger(this.context.namespace as string);
    logger.context = { ...this.context, ...ctx };
    return logger;
  }
}

// Create logger instances per namespace
export function createLogger(namespace: string): Logger {
  return new Logger(namespace);
}

// Singleton instances for commonly used namespaces
export const logger = createLogger("app");
export const reportLogger = createLogger("reports");
export const importLogger = createLogger("imports");
export const calculationLogger = createLogger("calculations");
export const workerLogger = createLogger("workers");
export const securityLogger = createLogger("security");
export const storageLogger = createLogger("storage");
export const notificationLogger = createLogger("notifications");
export const dsarLogger = createLogger("dsar");
export const authLogger = createLogger("auth");
export const ocrLogger = createLogger("ocr");
export const aibyteLogger = createLogger("airbyte");
export const airbyteSyncLogger = createLogger("airbyte-sync");
export const supplierLogger = createLogger("suppliers");
export const scope3Logger = createLogger("scope3");
