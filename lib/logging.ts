/**
 * Structured logging utility for CarbonSite
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  private formatMessage(level: LogLevel, message: string, context?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    if (context && Object.keys(context).length > 0) {
      return `[${timestamp}] ${level.toUpperCase()}: ${message} ${JSON.stringify(context)}`;
    }
    return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (this.isDevelopment) {
      console.debug(this.formatMessage('debug', message, context));
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    console.log(this.formatMessage('info', message, context));
  }

  warn(message: string, context?: Record<string, unknown>): void {
    console.warn(this.formatMessage('warn', message, context));
  }

  error(message: string, context?: Record<string, unknown>): void {
    console.error(this.formatMessage('error', message, context));
  }
}

export const logger = new Logger();
export default logger;
