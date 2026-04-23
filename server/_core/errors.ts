/**
 * Centralized Error System - Servicall CRM v2
 * Mappe les erreurs techniques vers des messages UI compréhensibles.
 */

export enum ErrorCode {
  // SYSTEM ERRORS
  INTERNAL_ERROR = "SYS001",
  DATABASE_ERROR = "SYS002",
  REDIS_UNAVAILABLE = "SYS003",
  TIMEOUT_ERROR = "SYS004",

  // AUTH ERRORS
  UNAUTHORIZED = "AUTH001",
  FORBIDDEN = "AUTH002",
  SESSION_EXPIRED = "AUTH003",
  INVALID_CREDENTIALS = "AUTH004",

  // BUSINESS ERRORS
  VALIDATION_FAILED = "BIZ001",
  NOT_FOUND = "BIZ002",
  CAMPAIGN_ALREADY_ACTIVE = "BIZ003",
  PROSPECT_ALREADY_ASSIGNED = "BIZ004",
  INSUFFICIENT_CREDITS = "BIZ005",

  // PROVIDER ERRORS
  SMS_PROVIDER_ERROR = "PROV001",
  WA_PROVIDER_ERROR = "PROV002",
  AI_SERVICE_ERROR = "PROV003",
}

export interface AppErrorOptions {
  code: ErrorCode;
  message: string;
  statusCode?: number;
  details?: any;
  isRetryable?: boolean;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: any;
  public readonly isRetryable: boolean;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = "AppError";
    this.code = options.code;
    this.statusCode = options.statusCode ?? 500;
    this.details = options.details;
    this.isRetryable = options.isRetryable ?? false;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * Retourne un message formaté pour l'UI
   */
  public toUI() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }
}

/**
 * Mapping des erreurs courantes vers AppError
 */
export const errorMapper = {
  notFound: (resource: string, id?: any) => new AppError({
    code: ErrorCode.NOT_FOUND,
    message: `${resource} non trouvé${id ? ` (ID: ${id})` : ""}.`,
    statusCode: 404
  }),

  validation: (details: any) => new AppError({
    code: ErrorCode.VALIDATION_FAILED,
    message: "Les données fournies sont invalides.",
    statusCode: 400,
    details
  }),

  unauthorized: (message = "Accès non autorisé.") => new AppError({
    code: ErrorCode.UNAUTHORIZED,
    message,
    statusCode: 401
  }),

  forbidden: (message = "Vous n'avez pas les permissions nécessaires.") => new AppError({
    code: ErrorCode.FORBIDDEN,
    message,
    statusCode: 403
  }),

  internal: (err?: any) => new AppError({
    code: ErrorCode.INTERNAL_ERROR,
    message: "Une erreur interne est survenue. Nos équipes ont été prévenues.",
    statusCode: 500,
    details: err?.message || err
  }),

  redis: () => new AppError({
    code: ErrorCode.REDIS_UNAVAILABLE,
    message: "Le service de cache/file d'attente est momentanément indisponible.",
    statusCode: 503,
    isRetryable: true
  })
};
