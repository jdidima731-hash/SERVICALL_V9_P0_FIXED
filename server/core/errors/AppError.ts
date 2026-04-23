/**
 * CENTRALIZED ERROR SYSTEM - Hard CTO Mode
 * PHASE 3 - Base AppError class
 */

export enum ErrorCode {
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  CONFLICT_ERROR = 'CONFLICT_ERROR',
}

export interface AppErrorOptions {
  code: ErrorCode;
  statusCode?: number;
  details?: any;
  cause?: any;
  isRetryable?: boolean;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: any;
  public readonly cause?: any;
  public readonly isRetryable: boolean;

  constructor(message: string, options: AppErrorOptions) {
    super(message);
    this.name = this.constructor.name;
    this.code = options.code;
    this.statusCode = options.statusCode ?? 500;
    this.details = options.details;
    this.cause = options.cause;
    this.isRetryable = options.isRetryable ?? false;

    // Capture stack trace, excluding the constructor from the stack
    (Error as any).captureStackTrace(this, this.constructor);
    
    // Ensure prototype chain is correctly set for instance of checks
    Object.setPrototypeOf(this, new.target.prototype);
  }

  public toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        ...(process.env['NODE_ENV'] !== 'production' && { stack: this.stack, cause: this.cause }),
      },
    };
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, {
      code: ErrorCode.VALIDATION_ERROR,
      statusCode: 400,
      details,
    });
  }
}

export class ExternalServiceError extends AppError {
  constructor(message: string, options: Omit<AppErrorOptions, 'code'>) {
    super(message, {
      ...options,
      code: ErrorCode.EXTERNAL_SERVICE_ERROR,
    });
  }
}
