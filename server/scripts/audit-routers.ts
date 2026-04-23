
/**
 * Script d'audit des routers tRPC pour le BLOC 2
 * Vérifie la conformité des routers avec les exigences de stabilité
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { logger } from "../infrastructure/logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface AuditResult {
  file: string;
  hasTryCatch: boolean;
  hasLogger: boolean;
  hasTRPCError: boolean;
  frenchMessages: boolean;
  nullHandling: boolean;
  score: number;
  issues: string[];
}

function auditRouter(filePath: string): AuditResult {
  const content = fs.readFileSync(filePath, "utf-8");
  const fileName = path.basename(filePath);
  
  const issues: string[] = [];
  let score = 0;
  
  // 1. Vérifier présence de try/catch
  const hasTryCatch = content.includes("try {") && content.includes("catch");
  if (hasTryCatch) {
    score += 20;
  } else {
    issues.push("❌ Aucun try/catch trouvé");
  }
  
  // 2. Vérifier utilisation du logger
  const hasLogger = content.includes("logger.") && content.includes("import { logger }");
  if (hasLogger) {
    score += 20;
  } else {
    issues.push("⚠️ Logger non utilisé");
  }
  
  // 3. Vérifier utilisation de TRPCError
  const hasTRPCError = content.includes("TRPCError") && content.includes("import");
  if (hasTRPCError) {
    score += 20;
  } else {
    issues.push("⚠️ TRPCError non importé");
  }
  
  // 4. Vérifier messages en français
  const frenchMessages = content.includes("message:") && (
    content.includes("Erreur") || 
    content.includes("trouvé") || 
    content.includes("disponible")
  );
  if (frenchMessages) {
    score += 20;
  } else {
    issues.push("⚠️ Messages probablement en anglais");
  }
  
  // 5. Vérifier gestion de null
  const nullHandling = content.includes("|| []") || content.includes("?? []") || content.includes("if (!") || content.includes("if (!");
  if (nullHandling) {
    score += 20;
  } else {
    issues.push("⚠️ Pas de gestion explicite de null/undefined");
  }
  
  return {
    file: fileName,
    hasTryCatch,
    hasLogger,
    hasTRPCError,
    frenchMessages,
    nullHandling,
    score,
    issues,
  };
}

function main() {
  const routersDir = path.join(__dirname, "../routers");
  const files = fs.readdirSync(routersDir).filter(f => f.endsWith("Router.ts") && !f.includes("OLD") && !f.includes("BLOC"));
  
  logger.info("🔍 AUDIT DES ROUTERS tRPC — BLOC 2\n");
  logger.info(`📁 Dossier: ${routersDir}`);
  logger.info(`📄 Fichiers à auditer: ${files.length}\n`);
  logger.info("=".repeat(80));
  
  const results: AuditResult[] = [];
  
  for (const file of files) {
    const filePath = path.join(routersDir, file);
    const result = auditRouter(filePath);
    results.push(result);
  }
  
  // Trier par score
  results.sort((a, b) => a.score - b.score);
  
  // Afficher les résultats
  logger.info("\n📊 RÉSULTATS DE L'AUDIT\n");
  
  let totalScore = 0;
  const criticalFiles: string[] = [];
  const warningFiles: string[] = [];
  const goodFiles: string[] = [];
  
  for (const result of results) {
    totalScore += result.score;
    
    let status = "";
    if (result.score >= 80) {
      status = "✅ EXCELLENT";
      goodFiles.push(result.file);
    } else if (result.score >= 60) {
      status = "⚠️ MOYEN";
      warningFiles.push(result.file);
    } else {
      status = "❌ CRITIQUE";
      criticalFiles.push(result.file);
    }
    
    logger.info(`${status} [${result.score}/100] ${result.file}`);
    if (result.issues.length > 0) {
      result.issues.forEach(issue => logger.info(`   ${issue}`));
    }
    logger.info("");
  }
  
  logger.info("=".repeat(80));
  logger.info("\n📈 STATISTIQUES GLOBALES\n");
  logger.info(`Score moyen: ${Math.round(totalScore / results.length)}/100`);
  logger.info(`Fichiers excellents (≥80): ${goodFiles.length}`);
  logger.info(`Fichiers moyens (60-79): ${warningFiles.length}`);
  logger.info(`Fichiers critiques (<60): ${criticalFiles.length}`);
  
  if (criticalFiles.length > 0) {
    logger.info("\n❌ FICHIERS CRITIQUES À CORRIGER EN PRIORITÉ:");
    criticalFiles.forEach(f => logger.info(`   - ${f}`));
  }
  
  if (warningFiles.length > 0) {
    logger.info("\n⚠️ FICHIERS À AMÉLIORER:");
    warningFiles.forEach(f => logger.info(`   - ${f}`));
  }
  
  logger.info("\n" + "=".repeat(80));
  
  // Verdict final
  const avgScore = Math.round(totalScore / results.length);
  if (avgScore >= 80 && criticalFiles.length === 0) {
    logger.info("\n✅ BLOC 2 — VALIDÉ");
    logger.info("Tous les routers ont une gestion d'erreurs acceptable.");
  } else {
    logger.info("\n❌ BLOC 2 — NON VALIDÉ");
    logger.info(`${criticalFiles.length + warningFiles.length} fichiers nécessitent des corrections.`);
  }
}

main();
