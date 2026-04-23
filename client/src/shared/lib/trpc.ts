import { createTRPCReact } from "@trpc/react-query";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@server/routers";

/**
 * PHASE 1 : TYPE PROXY POUR CONTOURNER LES LIMITES D'INFÉRENCE tRPC v11
 * 
 * L'AppRouter est maintenant défini comme un Type Proxy au lieu d'utiliser `typeof appRouter`.
 * Cela permet à TypeScript de reconnaître la structure du router sans avoir à inférer
 * la profondeur complète, ce qui évite l'effondrement de l'inférence causé par ProtectedIntersection.
 * 
 * Impact : Les erreurs TS2339 (propriétés manquantes sur le type AppRouter) devraient disparaître.
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * Inférence des types d'entrée et de sortie pour tRPC
 */
export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
