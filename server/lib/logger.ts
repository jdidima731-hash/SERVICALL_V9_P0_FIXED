import { logger as infrastructureLogger } from "../infrastructure/logger";

export interface StructuredLogPayload {
  [key: string]: unknown;
}

export class Logger {
  constructor(private readonly scope: string) {}

  private enrich(payload: StructuredLogPayload = {}): StructuredLogPayload {
    return {
      scope: this.scope,
      ...payload,
    };
  }

  trace(message: string, payload?: StructuredLogPayload): void {
    infrastructureLogger.trace(message, this.enrich(payload));
  }

  debug(message: string, payload?: StructuredLogPayload): void {
    infrastructureLogger.debug(message, this.enrich(payload));
  }

  info(message: string, payload?: StructuredLogPayload): void {
    infrastructureLogger.info(message, this.enrich(payload));
  }

  warn(message: string, payload?: StructuredLogPayload): void {
    infrastructureLogger.warn(message, this.enrich(payload));
  }

  error(message: string, error?: unknown, payload?: StructuredLogPayload): void {
    infrastructureLogger.error(message, error, this.enrich(payload));
  }

  fatal(message: string, error?: unknown, payload?: StructuredLogPayload): void {
    infrastructureLogger.fatal(message, error, this.enrich(payload));
  }
}

export const logger = infrastructureLogger;
export const createLogger = (scope: string): Logger => new Logger(scope);
