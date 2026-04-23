import GoogleDriveService from "../../services/GoogleDriveService";
import { logger } from "../../lib/logger";


export interface SaveToDriveConfig {
  spreadsheetId: string;
  sheetName: string;
  row: (string | number | boolean | null)[];
}

export class SaveToDriveAction {
  private googleDriveService: GoogleDriveService;

  constructor() {
    this.googleDriveService = new GoogleDriveService();
  }

  /**
   * Enregistre une ligne dans un Google Sheet
   */
  async execute(config: SaveToDriveConfig, context: Record<string, unknown>): Promise<unknown> {
    try {
      const { spreadsheetId, sheetName, row } = config;

      // Interpoler les variables dans la ligne
      const interpolatedRow = row.map((cell) => this.interpolateText(String(cell), context));

      // Ajouter la ligne au sheet
      const response = await this.googleDriveService.appendRow(spreadsheetId, sheetName, interpolatedRow);

      return {
        success: true,
        spreadsheetId,
        sheetName,
        updatedRange: response.data.updates?.updatedRange,
        updatedRows: response.data.updates?.updatedRows,
      };
    } catch (error: unknown) {
      logger.error("Error in SaveToDriveAction:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Interpole les variables dans le texte
   */
  private interpolateText(text: string, context: Record<string, unknown>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return context[key] !== undefined ? String(context[key]) : match;
    });
  }
}

export default SaveToDriveAction;
