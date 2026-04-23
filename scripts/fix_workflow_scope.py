from pathlib import Path

ROOT = Path("/home/user/work/project/src/home/ubuntu/project")

replacements = {
    'catch (error: any)': 'catch (error: unknown)',
    'catch (e: any)': 'catch (e: unknown)',
    'catch (err: any)': 'catch (err: unknown)',
    'catch (stripeError: any)': 'catch (stripeError: unknown)',
    'import * as twilioService from "../../../services/twilioService";': 'import * as twilioService from "@server/services/twilioService";',
    'import { logger } from "../../../infrastructure/logger";': 'import { logger } from "@server/lib/logger";',
    'import GoogleDriveService from "../../../services/GoogleDriveService";': 'import GoogleDriveService from "@server/services/GoogleDriveService";',
    'import { businessKnowledgeService } from "../../../services/BusinessKnowledgeService";': 'import { businessKnowledgeService } from "@server/services/BusinessKnowledgeService";',
    'import { resolveOpenAIKey } from "../../../_core/llm";': 'import { resolveOpenAIKey } from "@server/_core/llm";',
    'import { invokeLLM } from "../../../_core/llm";': 'import { invokeLLM } from "@server/_core/llm";',
    'import { AI_MODEL } from "../../../_core/aiModels";': 'import { AI_MODEL } from "@server/_core/aiModels";',
    "import { AI_MODEL } from '../../../_core/aiModels';": 'import { AI_MODEL } from "@server/_core/aiModels";',
    'import { getDbInstance, appointments } from "../../../db";': 'import { getDbInstance, appointments } from "@server/db";',
    'import { getDbInstance } from "../../../db";': 'import { getDbInstance } from "@server/db";',
    'import { getDbInstance, prospects } from "../../../db";': 'import { getDbInstance, prospects } from "@server/db";',
    'import { getDbInstance, prospects } from "../../../db";': 'import { getDbInstance, prospects } from "@server/db";',
    'import { prospects } from "../../../drizzle/schema";': 'import { prospects } from "@drizzle/schema";',
    'import * as schema from "../../../../drizzle/schema";': 'import * as schema from "@drizzle/schema";',
    'import { AuditService } from "../../../services/auditService";': 'import { AuditService } from "@server/services/auditService";',
    'import { calculateLeadScore } from "../../../services/scoringService";': 'import { calculateLeadScore } from "@server/services/scoringService";',
    'import { quickSentimentAnalysis } from "../../../services/sentimentAnalysisService";': 'import { quickSentimentAnalysis } from "@server/services/sentimentAnalysisService";',
    'import { OrderService } from "../../../services/orderService";': 'import { OrderService } from "@server/services/orderService";',
    'import { createPortalSession, createStripeCustomer } from "../../../services/stripeService";': 'import { createPortalSession, createStripeCustomer } from "@server/services/stripeService";',
    'import { ENV } from "../../../_core/env";': 'import { ENV } from "@server/_core/env";',
    'import { processedEvents } from "../../../drizzle/schema";': 'import { processedEvents } from "@drizzle/schema";',
    'import { statusEnum, outcomeEnum } from "../../../drizzle/schema";': 'import { statusEnum, outcomeEnum } from "@drizzle/schema";',
    'name = "crm_add_tag";': 'name = "add_tag";',
    "name = 'crm_add_tag';": "name = 'add_tag';",
    'name = "crm_assign_agent";': 'name = "assign_agent";',
    "name = 'crm_assign_agent';": "name = 'assign_agent';",
    'name = "crm_add_note";': 'name = "add_note";',
    "name = 'crm_add_note';": "name = 'add_note';",
    'name = "crm_export_data";': 'name = "export_data";',
    "name = 'crm_export_data';": "name = 'export_data';",
    'name = "drive";': 'name = "drive_action";',
    "name = 'drive';": "name = 'drive_action';",
    'response: any;': 'response: unknown;',
    'const rows = Array.isArray(results) ? results : (results as { rows?: any[] }).rows ?? [];': 'const rows = Array.isArray(results) ? results : (results as { rows?: unknown[] }).rows ?? [];',
}

for path in ROOT.joinpath("server/workflow-engine").rglob("*.ts"):
    content = path.read_text()
    original = content
    for before, after in replacements.items():
        content = content.replace(before, after)
    path.write_text(content)

# manual targeted fixes
create_order = ROOT / "server/workflow-engine/actions/payment/CreateOrderAction.ts"
content = create_order.read_text()
content = content.replace('        ? rawItems.map((item: any) => ({\n', '        ? rawItems.map((item) => ({\n')
content = content.replace('(order as { id?: any }).id', '(order as { id?: string | number }).id')
content = content.replace('(order as { orderNumber?: any }).orderNumber', '(order as { orderNumber?: string }).orderNumber')
content = content.replace('(order as { totalAmount?: any }).totalAmount', '(order as { totalAmount?: number }).totalAmount')
create_order.write_text(content)

query_db = ROOT / "server/workflow-engine/actions/dialogue/QueryDatabaseAction.ts"
content = query_db.read_text().replace('// 0.0.0.0 — any', '// 0.0.0.0 — wildcard')
query_db.write_text(content)

# Placeholder and ConditionEvaluator are rewritten separately if needed.
