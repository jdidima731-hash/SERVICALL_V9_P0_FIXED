import { router } from "./_core/trpc";
/**
 * ✅ FIX P0-B — NAMESPACE STRATEGY V8
 * - trpc.core.*          : auth, user, tenant, security, teamManager
 * - trpc.aiAutomation.*  : workflow, workflowEngine, workflowBuilder, ai, recruitment, etc.
 * - trpc.communication.* : calls, messaging, whatsapp, softphone, etc.
 * - trpc.business.*      : prospects, appointments, invoices, etc.
 * Tous les appels client DOIVENT utiliser ce namespace.
 */

// Import des sous-groupes de routeurs
import { coreRouter } from "./routers/coreRouters";
import { communicationRouter } from "./routers/communicationRouters";
import { businessRouter } from "./routers/businessRouters";
import { aiAutomationRouter } from "./routers/aiAutomationRouters";
import { billingLegalRouter } from "./routers/billingLegalRouters";
import { aiRouter } from "./routers/aiRouter";
import { agentAndIndustryRouter } from "./routers/agentAndIndustryRouters";
import { leadAndScoringRouter } from "./routers/leadAndScoringRouters";

// Import des routeurs restants
import { documentRouter } from "./routers/documentRouter";
import { predictiveRouter } from "./routers/predictiveRouter";
import { commandValidationRouter } from "./routers/commandValidationRouter";
import { healthRouter } from "./routers/healthRouter";
import { contactRouter } from "./routers/contactRouter";
import { socialRouter } from "./routers/socialRouter";
import { byokRouter } from "./routers/byokRouter";
import { servicesRouter } from "./routers/servicesRouter";
import { teamManagerRouter } from "./routers/teamManagerRouter";

// Procedures re-export pour compatibilité
import { tenantProcedure, managerProcedure, adminProcedure } from "./procedures";
export { tenantProcedure, managerProcedure, adminProcedure };

export const appRouter = router({
  // Sous-groupes de routeurs principaux
  core: coreRouter,
  ai: aiRouter,
  communication: communicationRouter,
  business: businessRouter,
  aiAutomation: aiAutomationRouter,
  billingLegal: billingLegalRouter,
  agentAndIndustry: agentAndIndustryRouter,
  leadAndScoring: leadAndScoringRouter,

  // Routeurs restants directement intégrés
  documents:         documentRouter,
  predictive:        predictiveRouter,
  commandValidation: commandValidationRouter,
  health:            healthRouter,
  contact:           contactRouter,
  social:            socialRouter,
  byok:              byokRouter,
  services:          servicesRouter,
});

/**
 * AppRouter type — inféré directement depuis typeof appRouter.
 */
export type AppRouter = typeof appRouter;

// Export createCaller pour les tests
export const createCaller = appRouter.createCaller;
