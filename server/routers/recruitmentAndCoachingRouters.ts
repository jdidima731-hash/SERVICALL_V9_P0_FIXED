/**
 * Recruitment & Coaching Routers (Groupe 4)
 * Contient tous les routers liés au recrutement et au coaching
 * Scission de aiAutomationRouters pour réduire la profondeur d'inférence tRPC
 */

import { router } from "../_core/trpc";
import { recruitmentRouter } from "./recruitmentRouter";
import { recruitmentEnhancedRouter } from "./recruitmentEnhancedRouter";
import { coachingRouter } from "./coachingRouter";

export const recruitmentAndCoachingRouter = router({
  recruitment: recruitmentRouter,
  recruitmentEnhanced: recruitmentEnhancedRouter,
  coaching: coachingRouter,
});
