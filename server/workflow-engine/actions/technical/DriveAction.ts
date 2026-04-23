/**
 * DRIVE ACTION
 * Gère les opérations sur les fichiers dans une sandbox sécurisée.
 * ✅ BLOC 5 : Config-driven, Sécurisé, Validation stricte.
 */

import { ActionHandler, ActionResult, ExecutionContext, ActionConfig } from "../../types";
import { Logger } from "../../infrastructure/logger";
import { z } from "zod";
import path from "path";
import fs from "fs/promises";

const driveConfigSchema = z.object({
  path: z.string().min(1, "Le chemin est obligatoire"),
  operation: z.enum(["write", "read", "delete"]).default("write"),
  content: z.string().optional(),
});

export class DriveAction implements ActionHandler<ActionConfig, ExecutionContext> {
  name = 'drive_action';
  private logger = new Logger('DriveAction');
  private readonly ALLOWED_ROOT = process.env['DRIVE_STORAGE_ROOT'] || "/home/ubuntu/servicall_v2/storage/drive_sandbox";

  async execute(context: ExecutionContext, config: ActionConfig): Promise<ActionResult<unknown>> {
    try {
      const validatedConfig = driveConfigSchema.parse(config);
      
      // Sécurisation du chemin (Sandbox stricte)
      const safePath = this.getSafePath(validatedConfig.path);
      
      this.logger.info(`Drive operation: ${validatedConfig.operation}`, { 
        path: validatedConfig.path,
        safePath,
        tenant: context.tenant.id 
      });

      let resultData: any = {
        operation: validatedConfig.operation,
        path: validatedConfig.path,
        timestamp: new Date().toISOString()
      };

      // Opérations réelles sur le système de fichiers
      switch (validatedConfig.operation) {
        case "write":
          if (validatedConfig.content === undefined) {
            throw new Error("Le contenu est obligatoire pour l'opération 'write'");
          }
          await fs.mkdir(path.dirname(safePath), { recursive: true });
          await fs.writeFile(safePath, validatedConfig.content, 'utf-8');
          resultData.status = 'success';
          break;

        case "read":
          try {
            const content = await fs.readFile(safePath, 'utf-8');
            resultData.content = content;
            resultData.status = 'success';
          } catch (e: any) {
            if (e.code === 'ENOENT') throw new Error("Fichier non trouvé");
            throw e;
          }
          break;

        case "delete":
          await fs.unlink(safePath);
          resultData.status = 'success';
          break;
      }

      return {
        success: true,
        data: resultData
      };

    } catch (error: unknown) {
      this.logger.error('Drive operation failed', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  validate(config: ActionConfig): boolean {
    try {
      driveConfigSchema.parse(config);
      return true;
    } catch {
      return false;
    }
  }

  private getSafePath(userPath: string): string {
    // 1. Interdiction absolue de ".."
    if (userPath.includes('..')) {
      throw new Error('Path traversal attempt detected');
    }

    // 2. Résolution du chemin absolu dans la sandbox
    const resolvedPath = path.resolve(this.ALLOWED_ROOT, userPath);

    // 3. Vérification que le chemin résolu est toujours dans la sandbox
    if (!resolvedPath.startsWith(this.ALLOWED_ROOT)) {
      throw new Error('Access denied: Path outside of sandbox');
    }

    return resolvedPath;
  }
}
