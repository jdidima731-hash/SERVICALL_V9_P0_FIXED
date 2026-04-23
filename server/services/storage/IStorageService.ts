/**
 * Interface pour le service de stockage
 */
export interface IStorageService {
  /**
   * Initialise le service de stockage
   */
  init(): Promise<void>;

  /**
   * Sauvegarde un fichier
   */
  saveFile(params: {
    tenantId: number;
    fileName: string;
    buffer: Buffer;
    mimeType: string;
    folder?: string;
  }): Promise<{ key: string; url: string }>;

  /**
   * Récupère l'URL d'un fichier (signée si nécessaire)
   */
  getFileUrl(key: string, expiresIn?: number): Promise<string>;

  /**
   * Supprime un fichier
   */
  deleteFile(key: string): Promise<void>;

  /**
   * Récupère les métadonnées d'un fichier
   */
  getFileMetadata(key: string): Promise<Record<string, any>>;
}
