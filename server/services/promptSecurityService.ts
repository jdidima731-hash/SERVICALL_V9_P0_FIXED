/**
 * PROMPT SECURITY SERVICE
 * ✅ PHASE 6 — Tâche 18 : Protection contre les injections de prompts
 *
 * Détecte et bloque les tentatives d'injection de prompts dans les entrées utilisateur.
 * Utilise une combinaison de règles heuristiques et de patterns connus.
 *
 * Catégories de menaces :
 *   1. Jailbreak direct ("ignore previous instructions")
 *   2. Injection de rôle ("you are now DAN")
 *   3. Extraction de prompt système ("repeat your instructions")
 *   4. Injection de délimiteurs ("</system>", "###")
 *   5. Encodage malveillant (base64, unicode escape)
 */
import { logger } from "../infrastructure/logger";

export interface PromptSecurityResult {
  safe: boolean;
  threats: PromptThreat[];
  sanitized: string;
  riskScore: number; // 0-100
}

export interface PromptThreat {
  type: ThreatType;
  severity: "low" | "medium" | "high" | "critical";
  pattern: string;
  description: string;
}

export type ThreatType =
  | "jailbreak"
  | "role_injection"
  | "system_extraction"
  | "delimiter_injection"
  | "encoding_attack"
  | "excessive_length"
  | "repeated_pattern";

interface ThreatPattern {
  type: ThreatType;
  severity: PromptThreat["severity"];
  regex: RegExp;
  description: string;
}

// ─── Patterns de détection ────────────────────────────────────────────────────
const THREAT_PATTERNS: ThreatPattern[] = [
  // Jailbreak direct
  {
    type: "jailbreak",
    severity: "critical",
    regex: /ignore\s+(previous|all|your|the)\s+(instructions?|prompts?|rules?|constraints?)/i,
    description: "Tentative d'ignorer les instructions système",
  },
  {
    type: "jailbreak",
    severity: "critical",
    regex: /forget\s+(everything|all|your|the)\s+(above|previous|instructions?)/i,
    description: "Tentative d'effacer les instructions précédentes",
  },
  {
    type: "jailbreak",
    severity: "high",
    regex: /do\s+anything\s+now|DAN\s+mode|jailbreak\s+mode/i,
    description: "Tentative de mode DAN ou jailbreak",
  },
  {
    type: "jailbreak",
    severity: "high",
    regex: /override\s+(safety|security|guidelines?|restrictions?|filters?)/i,
    description: "Tentative de contournement des règles de sécurité",
  },

  // Injection de rôle
  {
    type: "role_injection",
    severity: "high",
    regex: /you\s+are\s+(now|actually|really)\s+(a|an|the)\s+\w+/i,
    description: "Tentative d'injection de rôle",
  },
  {
    type: "role_injection",
    severity: "high",
    regex: /act\s+as\s+(a|an|the)\s+\w+\s+(without|ignoring|bypassing)/i,
    description: "Tentative de changement de comportement via rôle",
  },
  {
    type: "role_injection",
    severity: "medium",
    regex: /pretend\s+(you\s+are|to\s+be)\s+/i,
    description: "Tentative de simulation de rôle alternatif",
  },

  // Extraction du prompt système
  {
    type: "system_extraction",
    severity: "high",
    regex: /repeat\s+(your|the)\s+(system\s+)?(prompt|instructions?|rules?)/i,
    description: "Tentative d'extraction du prompt système",
  },
  {
    type: "system_extraction",
    severity: "high",
    regex: /what\s+(are|were)\s+your\s+(original\s+)?(instructions?|system\s+prompt)/i,
    description: "Tentative de lecture du prompt système",
  },
  {
    type: "system_extraction",
    severity: "medium",
    regex: /show\s+me\s+(your|the)\s+(system|initial|original)\s+(prompt|instructions?)/i,
    description: "Tentative d'affichage du prompt système",
  },

  // Injection de délimiteurs
  {
    type: "delimiter_injection",
    severity: "high",
    regex: /<\/?system>|<\/?human>|<\/?assistant>|<\/?user>/i,
    description: "Injection de balises de délimitation",
  },
  {
    type: "delimiter_injection",
    severity: "medium",
    regex: /#{3,}\s*(system|instructions?|prompt)/i,
    description: "Injection de délimiteurs markdown",
  },
  {
    type: "delimiter_injection",
    severity: "medium",
    regex: /\[INST\]|\[\/INST\]|\[SYS\]|\[\/SYS\]/,
    description: "Injection de délimiteurs de modèle (Llama, Mistral)",
  },

  // Encodage malveillant
  {
    type: "encoding_attack",
    severity: "medium",
    regex: /base64\s*:\s*[A-Za-z0-9+/]{20,}/,
    description: "Contenu encodé en base64 suspect",
  },
  {
    type: "encoding_attack",
    severity: "low",
    regex: /\\u[0-9a-fA-F]{4}.*\\u[0-9a-fA-F]{4}.*\\u[0-9a-fA-F]{4}/,
    description: "Séquences d'échappement Unicode multiples",
  },
];

const MAX_INPUT_LENGTH = 4000; // caractères
const REPEATED_PATTERN_THRESHOLD = 50; // répétitions suspectes

/**
 * Analyse une entrée utilisateur pour détecter les injections de prompts.
 *
 * @param input Texte saisi par l'utilisateur
 * @param tenantId Identifiant du tenant (pour les logs)
 * @returns Résultat de l'analyse avec score de risque et texte assaini
 */
export function analyzePromptSecurity(input: string, tenantId?: number): PromptSecurityResult {
  const threats: PromptThreat[] = [];
  let riskScore = 0;

  // Vérification de la longueur
  if (input.length > MAX_INPUT_LENGTH) {
    threats.push({
      type: "excessive_length",
      severity: "medium",
      pattern: `length=${input.length}`,
      description: `Entrée trop longue (${input.length} > ${MAX_INPUT_LENGTH} caractères)`,
    });
    riskScore += 20;
  }

  // Détection de patterns répétés (padding attack)
  const repeatedChars = new RegExp(`(.)\\1{${REPEATED_PATTERN_THRESHOLD - 1},}`).test(input);
  if (repeatedChars) {
    threats.push({
      type: "repeated_pattern",
      severity: "low",
      pattern: "repeated_chars",
      description: "Caractères répétés excessivement (possible padding attack)",
    });
    riskScore += 10;
  }

  // Analyse des patterns de menaces
  for (const pattern of THREAT_PATTERNS) {
    if (pattern.regex.test(input)) {
      threats.push({
        type: pattern.type,
        severity: pattern.severity,
        pattern: pattern.regex.source,
        description: pattern.description,
      });

      // Score selon la sévérité
      switch (pattern.severity) {
        case "critical": riskScore += 50; break;
        case "high": riskScore += 30; break;
        case "medium": riskScore += 15; break;
        case "low": riskScore += 5; break;
      }
    }
  }

  riskScore = Math.min(100, riskScore);

  // Sanitisation : tronquer si trop long, supprimer les balises HTML/XML
  let sanitized = input
    .substring(0, MAX_INPUT_LENGTH)
    .replace(/<[^>]*>/g, "") // Supprimer les balises HTML/XML
    .replace(/\[INST\]|\[\/INST\]|\[SYS\]|\[\/SYS\]/g, "") // Supprimer les délimiteurs de modèle
    .trim();

  const safe = riskScore < 30; // Seuil de blocage

  if (!safe) {
    logger.warn("[PromptSecurity] Potential injection detected", {
      tenantId,
      riskScore,
      threatCount: threats.length,
      threatTypes: threats.map((t: any) => t.type),
      inputPreview: input.substring(0, 100),
    });
  } else if (threats.length > 0) {
    logger.debug("[PromptSecurity] Low-risk patterns detected", {
      tenantId,
      riskScore,
      threatCount: threats.length,
    });
  }

  return { safe, threats, sanitized, riskScore };
}

/**
 * Middleware de sécurité des prompts pour les routes API.
 * Bloque les requêtes avec un score de risque ≥ 30.
 */
export function promptSecurityGuard(
  userMessage: string,
  tenantId: number
): { allowed: boolean; reason?: string; sanitized: string } {
  const result = analyzePromptSecurity(userMessage, tenantId);

  if (!result.safe) {
    const highestSeverity = result.threats.reduce(
      (max, t) => {
        const order = { critical: 4, high: 3, medium: 2, low: 1 };
        return order[t.severity] > order[max] ? t.severity : max;
      },
      "low" as PromptThreat["severity"]
    );

    return {
      allowed: false,
      reason: `Requête bloquée pour sécurité (score: ${result.riskScore}/100, sévérité: ${highestSeverity})`,
      sanitized: result.sanitized,
    };
  }

  return { allowed: true, sanitized: result.sanitized };
}
