/**
 * Agent & Industry Routers (Groupe 5)
 * Contient tous les routers liés aux agents, à la configuration d'industrie et aux rapports
 * Scission de aiAutomationRouters pour réduire la profondeur d'inférence tRPC
 */

import { router } from "../_core/trpc";
import { agentSwitchRouter } from "./agentSwitchRouter";
import { industryConfigRouter } from "./industryConfigRouter";
import { industryRouter } from "./industryRouter";
import { reportRouter } from "./reportRouter";
import { roiRouter } from "./roiRouter";
import { servicallV3Router } from "./servicallV3Router";
import { webhookRouter } from "./webhookRouter";
import { blueprintMarketplaceRouter } from "./blueprintMarketplaceRouter";

export const agentAndIndustryRouter = router({
  agentSwitch: agentSwitchRouter,
  industryConfig: industryConfigRouter,
  industry: industryRouter,
  report: reportRouter,
  roi: roiRouter,
  servicallV3: servicallV3Router,
  webhook: webhookRouter,
  blueprintMarketplace: blueprintMarketplaceRouter,
});
