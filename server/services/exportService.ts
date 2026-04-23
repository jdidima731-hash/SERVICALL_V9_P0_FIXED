/**
 * BLOC 3+ - Export Service
 * Gère l'exportation des données d'appels et prospects vers des stockages externes
 */

import { logger } from "../infrastructure/logger";
import * as fs from "fs";
import * as path from "path";

export interface CallDataExport {
  prospectName: string;
  prospectPhone: string;
  callDate: string;
  demand: string;
  status: string;
  notes?: string;
}

export class ExportService {
  private static EXPORT_DIR = path.join(process.cwd(), "exports");

  /**
   * Enregistre les données d'un appel dans un fichier JSON local (Simulant Google Drive pour le MVP)
   * Dans une version de production, cela utiliserait l'API Google Drive
   */
  static async exportCallToCloud(tenantId: number, data: CallDataExport): Promise<string> {
    try {
      // S'assurer que le dossier d'export existe
      if (!fs.existsSync(this.EXPORT_DIR)) {
        fs.mkdirSync(this.EXPORT_DIR, { recursive: true });
      }

      const tenantDir = path.join(this.EXPORT_DIR, `tenant_${tenantId}`);
      if (!fs.existsSync(tenantDir)) {
        fs.mkdirSync(tenantDir, { recursive: true });
      }

      const filename = `call_${Date.now()}_${data.prospectPhone.replace(/\+/g, "")}.json`;
      const filepath = path.join(tenantDir, filename);

      fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
      
      logger.info("[Export Service] Call data exported successfully", { tenantId, filepath });
      
      // Simulation de l'URL Google Drive
      return `https://drive.google.com/simulated/file/${filename}`;
    } catch (error: any) {
      logger.error("[Export Service] Failed to export call data", { error, tenantId });
      throw new Error("Échec de l'exportation des données");
    }
  }

  /**
   * Exportation groupée vers un CSV (pourrait être envoyé sur Drive)
   */
  static async exportToCSV(tenantId: number, dataList: CallDataExport[]): Promise<string> {
    try {
      const header = "Nom,Téléphone,Date,Demande,Statut,Notes\n";
      const rows = dataList.map(d => 
        `"${d.prospectName}","${d.prospectPhone}","${d.callDate}","${d.demand.replace(/"/g, '""')}","${d.status}","${(d.notes ?? "").replace(/"/g, '""')}"`
      ).join("\n");

      const filename = `export_${Date.now()}.csv`;
      const filepath = path.join(this.EXPORT_DIR, `tenant_${tenantId}`, filename);
      
      fs.writeFileSync(filepath, header + rows);
      return filepath;
    } catch (error: any) {
      logger.error("[Export Service] Failed to export CSV", { error });
      throw error;
    }
  }
}
