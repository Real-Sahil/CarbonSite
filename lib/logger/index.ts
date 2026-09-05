// Structured logging abstraction backed by pino.
// In production, emits newline-delimited JSON to stdout for indexing by log aggregators.
// In development (LOG_PRETTY=true or NODE_ENV=development), pino-pretty formats the output.
// Sentry is notified for warn/error levels when SENTRY_DSN is set.

import pino from "pino";
import * as Sentry from "@sentry/nextjs";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogContext = Record<string, unknown>;

const isDev =
  process.env.NODE_ENV === "development" || process.env.LOG_PRETTY === "true";

const pinoOpts: pino.LoggerOptions = { level: process.env.LOG_LEVEL ?? "info" };

const rootPino = isDev
  ? pino(pinoOpts, pino.transport({
      target: "pino-pretty",
      options: { colorize: true, translateTime: "SYS:standard", ignore: "pid,hostname" },
    }))
  : pino(pinoOpts);

class Logger {
  private child: pino.Logger;
  // Keep context accessible so withContext can merge it
  private ctx: LogContext;

  constructor(namespace: string, ctx: LogContext = {}) {
    this.ctx = { namespace, ...ctx };
    this.child = rootPino.child(this.ctx);
  }

  private sentryCapture(level: "warn" | "error", message: string, ctx?: LogContext): void {
    if (!process.env.SENTRY_DSN) return;
    try {
      const combined = ctx ? { ...this.ctx, ...ctx } : this.ctx;
      if (Object.keys(combined).length > 0) {
        Sentry.setContext("structured_log", combined);
      }
      Sentry.captureMessage(message, level === "error" ? "error" : "warning");
    } catch {
      // Sentry unavailable — continue
    }
  }

  debug(message: string, context?: LogContext): void {
    context ? this.child.debug(context, message) : this.child.debug(message);
  }

  info(message: string, context?: LogContext): void {
    context ? this.child.info(context, message) : this.child.info(message);
  }

  warn(message: string, context?: LogContext): void {
    context ? this.child.warn(context, message) : this.child.warn(message);
    this.sentryCapture("warn", message, context);
  }

  error(message: string, context?: LogContext): void {
    context ? this.child.error(context, message) : this.child.error(message);
    this.sentryCapture("error", message, context);
  }

  withContext(ctx: LogContext): Logger {
    return new Logger(this.ctx.namespace as string, { ...this.ctx, ...ctx });
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
export const scope3Logger = createLogger("scope3");
export const supplierLogger = createLogger("suppliers");
