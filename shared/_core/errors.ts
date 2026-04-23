import { ZodError } from "zod";

export type AppErrorCode =
  | "FORBIDDEN"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "UNKNOWN_ACTION"
  | "INVALID_WORKFLOW_DEFINITION"
  | "TENANT_RESOLUTION_FAILED"
  | "JSON_PARSE_ERROR"
  | "INTERNAL_ERROR";

export interface AppErrorContext {
  details?: Record<string, unknown>;
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly details: Record<string, unknown>;
  override readonly cause?: unknown;

  constructor(code: AppErrorCode, message: string, context: AppErrorContext = {}) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = context.details ?? {};
    this.cause = context.cause;
  }

  static fromUnknown(
    code: AppErrorCode,
    message: string,
    error: unknown,
    details: Record<string, unknown> = {},
  ): AppError {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof ZodError) {
      return new AppError("VALIDATION_ERROR", message, {
        cause: error,
        details: {
          ...details,
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
            code: issue.code,
          })),
        },
      });
    }

    if (error instanceof Error) {
      return new AppError(code, message, {
        cause: error,
        details: {
          ...details,
          originalMessage: error.message,
        },
      });
    }

    return new AppError(code, message, {
      cause: error,
      details: {
        ...details,
        originalError: String(error),
      },
    });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super("FORBIDDEN", message);
    this.name = "ForbiddenError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super("UNAUTHORIZED", message);
    this.name = "UnauthorizedError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not Found") {
    super("NOT_FOUND", message);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation Error", details: Record<string, unknown> = {}) {
    super("VALIDATION_ERROR", message, { details });
    this.name = "ValidationError";
  }
}
