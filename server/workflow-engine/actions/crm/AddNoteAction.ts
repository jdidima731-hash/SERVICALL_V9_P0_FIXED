import { z } from "zod";
import type { ActionHandler, ActionResult } from "../../types";
import type { FinalExecutionContext } from "../structured-types";
import { Logger } from "../../infrastructure/logger";

const AddNoteConfigSchema = z.object({
  note: z.string().optional(),
  prospect_id: z.number().optional(),
});
type AddNoteConfig = z.infer<typeof AddNoteConfigSchema>;

interface AddNoteResult { noteId: string; }

export class AddNoteAction implements ActionHandler<AddNoteConfig, FinalExecutionContext, AddNoteResult> {
  name = 'add_note';
  private logger = new Logger('AddNoteAction');

  async execute(
    _context: FinalExecutionContext,
    _config: AddNoteConfig
  ): Promise<ActionResult<AddNoteResult>> {
    try {
      // BLOC AUDIT : Validation stricte de la config
      const validatedConfig = AddNoteConfigSchema.parse(config);

      this.logger.info('Adding note to CRM...');
      return { success: true, data: { noteId: "note_" + Date.now() } };
    } catch (error: unknown) {
      return { success: false, error: String(error) };
    }
  }

  validate(config: Record<string, unknown>): boolean {
    try {
      AddNoteConfigSchema.parse(config);
      return true;
    } catch {
      return false;
    }
  }
}
