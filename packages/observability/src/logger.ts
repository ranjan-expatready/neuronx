// Structured Logging Interface - FAANG-grade observability

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  correlationId?: string;
  tenantId?: string;
  userId?: string;
  requestId?: string;
  operation?: string;
  component?: string;
  duration?: number;
  error?: Error;
  [key: string]: any;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  child(context: LogContext): Logger;
}

// Simple console-based logger implementation
export class ConsoleLogger implements Logger {
  constructor(
    private level: LogLevel = 'info',
    private baseContext: LogContext = {}
  ) {}

  private shouldLog(level: LogLevel): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    context: LogContext = {}
  ): string {
    const timestamp = new Date().toISOString();
    const mergedContext = { ...this.baseContext, ...context };
    const contextStr =
      Object.keys(mergedContext).length > 0
        ? ` ${JSON.stringify(mergedContext)}`
        : '';

    return `[${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`;
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, context));
    }
  }

  error(message: string, context?: LogContext): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, context));
    }
  }

  child(additionalContext: LogContext): Logger {
    return new ConsoleLogger(this.level, {
      ...this.baseContext,
      ...additionalContext,
    });
  }
}

// Global logger instance
let globalLogger: Logger = new ConsoleLogger(
  (process.env.LOG_LEVEL as LogLevel) || 'info'
);

// Logger factory
export function createLogger(context?: LogContext): Logger {
  return globalLogger.child(context || {});
}

export function setGlobalLogger(logger: Logger): void {
  globalLogger = logger;
}

// Convenience functions
export const logger = {
  debug: (message: string, context?: LogContext) =>
    globalLogger.debug(message, context),
  info: (message: string, context?: LogContext) =>
    globalLogger.info(message, context),
  warn: (message: string, context?: LogContext) =>
    globalLogger.warn(message, context),
  error: (message: string, context?: LogContext) =>
    globalLogger.error(message, context),
  child: (context: LogContext) => globalLogger.child(context),
};
