import { z } from "zod";
import type { ActionHandler, ActionResult } from "../../types";
import type { FinalExecutionContext } from "../structured-types";
import { Logger } from "../../infrastructure/logger";

const CreateTaskConfigSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  due_date: z.string().optional(),
  assigned_to: z.union([z.string(), z.number()]).optional(),
});
type CreateTaskConfig = z.infer<typeof CreateTaskConfigSchema>;

interface CreateTaskResult { taskId: string; status: 'created'; }

export class CreateTaskAction implements ActionHandler<CreateTaskConfig, FinalExecutionContext, CreateTaskResult> {
  name = 'create_task';
  private logger = new Logger('CreateTaskAction');

  async execute(
    _context: FinalExecutionContext,
    config: CreateTaskConfig
  ): Promise<ActionResult<CreateTaskResult>> {
    try {
      const validatedConfig = CreateTaskConfigSchema.parse(config);

      this.logger.info('Creating task in CRM...', validatedConfig);
      return { success: true, data: { taskId: `task_${Date.now()}`, status: "created" } };
    } catch (error: unknown) {
      return { success: false, error: String(error) };
    }
  }

  validate(config: Record<string, unknown>): boolean {
    try {
      CreateTaskConfigSchema.parse(config);
      return true;
    } catch {
      return false;
    }
  }
}
