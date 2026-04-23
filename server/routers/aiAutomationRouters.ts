/**
 * AI Automation Router — structure complète
 * Tous les sous-routers enregistrés
 */
import { router } from "../_core/trpc";
import { workflowRouter }            from "./workflowRouter";
import { workflowEngineRouter }      from "./workflowEngineRouter";
import { workflowBuilderRouter }     from "./workflowBuilderRouter";
import { realtimeWorkflowRouter }    from "./realtimeWorkflowRouter";
import { aiRouter }                  from "./aiRouter";
import { dialogueRouter }            from "./dialogueRouter";
import { agentSwitchRouter }         from "./agentSwitchRouter";
import { leadScoringRouter }         from "./leadScoringRouter";
import { callScoringRouter }         from "./callScoringRouter";
import { coachingRouter }            from "./coachingRouter";
import { aiMemoryRouter }            from "./aiMemoryRouter";
import { aiSuggestionsRouter }       from "./aiSuggestionsRouter";
import { copilotRouter }             from "./copilotRouter";
import { industryConfigRouter }      from "./industryConfigRouter";
import { industryRouter }            from "./industryRouter";
import { recruitmentRouter }         from "./recruitmentRouter";
import { recruitmentEnhancedRouter } from "./recruitmentEnhancedRouter";
import { reportRouter }              from "./reportRouter";
import { roiRouter }                 from "./roiRouter";
import { servicallV3Router }         from "./servicallV3Router";
import { leadExtractionRouter }      from "./leadExtractionRouter";
import { b2cLeadExtractionRouter }   from "./b2cLeadExtractionRouter";

export const aiAutomationRouter = router({
  workflow:            workflowRouter,
  workflows:           workflowRouter,
  workflowEngine:      workflowEngineRouter,
  workflowBuilder:     workflowBuilderRouter,
  realtimeWorkflow:    realtimeWorkflowRouter,
  ai:                  aiRouter,
  dialogue:            dialogueRouter,
  agentSwitch:         agentSwitchRouter,
  leadScoring:         leadScoringRouter,
  callScoring:         callScoringRouter,
  coaching:            coachingRouter,
  aiMemory:            aiMemoryRouter,
  aiSuggestions:       aiSuggestionsRouter,
  copilot:             copilotRouter,
  industryConfig:      industryConfigRouter,
  industry:            industryRouter,
  recruitment:         recruitmentRouter,
  recruitmentEnhanced: recruitmentEnhancedRouter,
  report:              reportRouter,
  roi:                 roiRouter,
  servicallV3:         servicallV3Router,
  leadExtraction:      leadExtractionRouter,
  b2cLeadExtraction:   b2cLeadExtractionRouter,
});
