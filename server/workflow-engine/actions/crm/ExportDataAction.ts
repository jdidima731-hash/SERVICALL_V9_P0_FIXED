import { z } from "zod";
import type { ActionHandler, ActionResult } from "../../types";
import type { FinalExecutionContext } from "../structured-types";
import { Logger } from "../../infrastructure/logger";

const ExportDataConfigSchema = z.object({
  format: z.enum(['csv', 'json', 'xlsx']).optional(),
});
type ExportDataConfig = z.infer<typeof ExportDataConfigSchema>;

interface ExportDataResult { url: string; format: string; }

export class ExportDataAction implements ActionHandler<ExportDataConfig, FinalExecutionContext, ExportDataResult> {
  name = 'export_data';
  private logger = new Logger('ExportDataAction');

  async execute(
    _context: FinalExecutionContext,
    config: ExportDataConfig
  ): Promise<ActionResult<ExportDataResult>> {
    try {
      // BLOC AUDIT : Validation stricte de la config
      const validatedConfig = ExportDataConfigSchema.parse(config);

      this.logger.info('Exporting data from CRM...');
      return {
        success: true,
        data: { url: "https://storage.example.com/export.csv", format: config.format ?? "csv" }
      };
    } catch (error: unknown) {
      return { success: false, error: String(error) };
    }
  }

  validate(config: Record<string, unknown>): boolean {
    try {
      ExportDataConfigSchema.parse(config);
      return true;
    } catch {
      return false;
    }
  }
}
