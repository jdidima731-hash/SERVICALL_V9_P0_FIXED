import { google } from "googleapis";
import { JWT } from "google-auth-library";
import { logger } from "../infrastructure/logger";

export class GoogleDriveService {
  private sheets: any;
  private auth: JWT;

  constructor() {
    const keyFile = process.env['GOOGLE_SERVICE_ACCOUNT_KEY'];

    if (!keyFile) {
      logger.error("GOOGLE_SERVICE_ACCOUNT_KEY environment variable not set");
      throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY environment variable not set");
    }

    // Parser la clé de service
    const keyData = JSON.parse(keyFile);

    this.auth = new JWT({
      email: keyData.client_email,
      key: keyData.private_key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    this.sheets = google.sheets({ version: "v4", auth: this.auth });
  }

  /**
   * Ajoute une ligne à un Google Sheet spécifié.
   * @param spreadsheetId L'ID du Google Sheet.
   * @param sheetName Le nom de la feuille dans le Google Sheet.
   * @param row Les données de la ligne à ajouter.
   * @returns Les informations sur la mise à jour.
   */
  async appendRow(
    spreadsheetId: string,
    sheetName: string,
    row: any[]
  ): Promise<any> {
    try {
      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:Z`, // Assumer que nous ajoutons à la fin
        valueInputOption: "RAW",
        requestBody: {
          values: [row],
        },
      });
      logger.info(`Row appended to Google Sheet ${spreadsheetId}/${sheetName}`, { updatedRange: response.data.updates?.updatedRange });
      return response.data;
    } catch (error: any) {
      logger.error(`Error appending row to Google Sheet ${spreadsheetId}/${sheetName}:`, error);
      throw error;
    }
  }

  /**
   * Lit des données d'un Google Sheet spécifié.
   * @param spreadsheetId L'ID du Google Sheet.
   * @param range La plage de cellules à lire (ex: 'Feuil1!A1:B5').
   * @returns Les valeurs lues.
   */
  async readSheet(
    spreadsheetId: string,
    range: string
  ): Promise<any> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });
      logger.info(`Data read from Google Sheet ${spreadsheetId}/${range}`);
      return response.data.values;
    } catch (error: any) {
      logger.error(`Error reading from Google Sheet ${spreadsheetId}/${range}:`, error);
      throw error;
    }
  }
}

export default GoogleDriveService;
