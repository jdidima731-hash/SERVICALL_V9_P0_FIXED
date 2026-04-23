import { z } from "zod";
import type { ActionHandler, ActionResult } from "../../types";
import type { FinalExecutionContext } from "../structured-types";
import { Logger } from "../../infrastructure/logger";

const AddTagConfigSchema = z.object({
  tag: z.string().optional(),
});
type AddTagConfig = z.infer<typeof AddTagConfigSchema>;

interface AddTagResult { tag: string; }

export class AddTagAction implements ActionHandler<AddTagConfig, FinalExecutionContext, AddTagResult> {
  name = 'add_tag';
  private logger = new Logger('AddTagAction');

  async execute(
    _context: FinalExecutionContext,
    config: AddTagConfig
  ): Promise<ActionResult<AddTagResult>> {
    try {
      // BLOC AUDIT : Validation stricte de la config
      const validatedConfig = AddTagConfigSchema.parse(config);

      this.logger.info('Adding tag in CRM...');
      return { success: true, data: { tag: config.tag ?? "auto-tagged" } };
    } catch (error: unknown) {
      return { success: false, error: String(error) };
    }
  }

  validate(config: Record<string, unknown>): boolean {
    try {
      AddTagConfigSchema.parse(config);
      return true;
    } catch {
      return false;
    }
  }
}
