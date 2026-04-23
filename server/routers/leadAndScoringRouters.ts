/**
 * Lead & Scoring Routers (Groupe 3)
 * Contient tous les routers liés aux leads, scoring et extraction
 * Scission de aiAutomationRouters pour réduire la profondeur d'inférence tRPC
 */

import { router } from "../_core/trpc";
import { leadScoringRouter } from "./leadScoringRouter";
import { callScoringRouter } from "./callScoringRouter";
import { leadExtractionRouter } from "./leadExtractionRouter";
import { b2cLeadExtractionRouter } from "./b2cLeadExtractionRouter";

export const leadAndScoringRouter = router({
  leadScoring: leadScoringRouter,
  callScoring: callScoringRouter,
  leadExtraction: leadExtractionRouter,
  b2cLeadExtraction: b2cLeadExtractionRouter,
});
