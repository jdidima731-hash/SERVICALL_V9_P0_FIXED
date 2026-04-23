import type { AuthenticatedUser } from '../services/authService';

// Déclarations de types globaux pour le backend

declare module 'tw-animate-css' {
  const content: any;
  export default content;
}

declare module '@sentry/node' {
  export const init: (options: any) => void;
  export const captureException: (error: any) => void;
  export const captureMessage: (message: string) => void;
}

// Types pour les modules internes
declare module '*/loggingService' {
  export interface LogContext {
    [key: string]: any;
    status?: number;
  }
  export const logger: any;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      googleAccessToken?: string;
      /** tenantId injecté par apiKeyMiddleware via header x-api-key */
      apiKeyTenantId?: number;
      /** Identifiant unique de corrélation ajouté par correlationIdMiddleware */
      correlationId?: string;
      /** tenantId résolu par tenantIsolationMiddleware */
      tenantId?: number;
      /** Contexte tenant complet résolu par tenantIsolationMiddleware */
      tenantContext?: import("../services/tenantService").TenantPayload | null;
    }
  }
  
  // Définition de db pour éviter les erreurs d'accès global
  var db: any;
}

// Déclarations permissives pour minimiser les erreurs TS
declare module "ws";
declare module "stripe";
declare module "drizzle-orm";
declare module "drizzle-orm/*";
declare module "@db/schema";
declare module "@shared/*";

// L'indexation globale de Object est déconseillée et cause des erreurs TS7006/TS7031 massives.
// Utilisez Record<string, any> ou des types plus spécifiques dans le code.
