/**
 * PRODUCTION READINESS CHECK
 * Vérifie que tous les secrets sont configurés avant le démarrage en production
 * ✅ BLOC 6: Sécurisation des secrets
 */

import { logger } from "../infrastructure/logger";

interface SecretCheck {
  name: string;
  envVar: string;
  required: boolean;
  defaultValue?: string;
}

const REQUIRED_SECRETS: SecretCheck[] = [
  // Base de données
  {
    name: 'Database URL',
    envVar: 'DATABASE_URL',
    required: true,
    defaultValue: 'postgresql://postgres:postgres@localhost:5432/servicall',
  },
  
  // Session & Sécurité
  {
    name: 'Session Secret',
    envVar: 'SESSION_SECRET',
    required: true,
    defaultValue: 'dev-secret-change-me',
  },
  {
    name: 'CSRF Secret',
    envVar: 'CSRF_SECRET',
    required: true,
    defaultValue: 'csrf-secret-change-me',
  },
  
  // Twilio (API externes)
  {
    name: 'Twilio Account SID',
    envVar: 'TWILIO_ACCOUNT_SID',
    required: false,
  },
  {
    name: 'Twilio Auth Token',
    envVar: 'TWILIO_AUTH_TOKEN',
    required: false,
  },
  
  // OpenAI
  {
    name: 'OpenAI API Key',
    envVar: 'OPENAI_API_KEY',
    required: false,
  },
  
  // Encryption
  {
    name: 'Encryption Key',
    envVar: 'ENCRYPTION_KEY',
    required: true,
    defaultValue: 'dev-encryption-key-32-characters',
  },
];

interface CheckResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Vérifie si une valeur est une valeur par défaut non sécurisée
 */
function isDefaultValue(value: string, defaultValue?: string): boolean {
  if (!defaultValue) return false;
  
  const unsafePatterns = [
    'dev-',
    'test-',
    'change-me',
    'postgres:postgres@',
    'secret-change-me',
  ];
  
  // Vérifier si la valeur correspond exactement à la valeur par défaut
  if (value === defaultValue) return true;
  
  // Vérifier si la valeur contient des patterns non sécurisés
  return unsafePatterns.some(pattern => value.toLowerCase().includes(pattern));
}

/**
 * Vérifie tous les secrets requis
 */
export function checkProductionReadiness(): CheckResult {
  const result: CheckResult = {
    passed: true,
    errors: [],
    warnings: [],
  };
  
  const isProduction = process.env['NODE_ENV'] === 'production';
  
  logger.info('[Production Check] Starting production readiness check', {
    environment: process.env['NODE_ENV'],
    isProduction,
  });
  
  for (const secret of REQUIRED_SECRETS) {
    const value = process.env[secret.envVar];
    
    // Vérifier si le secret est défini
    if (!value || value.trim() === '') {
      if (secret.required) {
        result.errors.push(
          `❌ ${secret.name} (${secret.envVar}) is required but not set`
        );
        result.passed = false;
      } else {
        result.warnings.push(
          `⚠️  ${secret.name} (${secret.envVar}) is not set (optional)`
        );
      }
      continue;
    }
    
    // En production, vérifier si c'est une valeur par défaut
    if (isProduction && isDefaultValue(value, secret.defaultValue)) {
      result.errors.push(
        `❌ ${secret.name} (${secret.envVar}) is using a default/unsafe value in production`
      );
      result.passed = false;
      continue;
    }
    
    // En développement, avertir si c'est une valeur par défaut
    if (!isProduction && isDefaultValue(value, secret.defaultValue)) {
      result.warnings.push(
        `⚠️  ${secret.name} (${secret.envVar}) is using a default value (OK for dev)`
      );
    }
    
    logger.info(`[Production Check] ✅ ${secret.name} is configured`);
  }
  
  return result;
}

/**
 * Affiche les résultats de la vérification
 */
export function displayCheckResults(result: CheckResult): void {
  logger.info('\n' + '='.repeat(60));
  logger.info('🛡️  PRODUCTION READINESS CHECK');
  logger.info('='.repeat(60) + '\n');
  
  if (result.errors.length > 0) {
    logger.info('❌ ERRORS (BLOCKING):');
    result.errors.forEach(error => logger.info(`   ${error}`));
    logger.info('');
  }
  
  if (result.warnings.length > 0) {
    logger.info('⚠️  WARNINGS (NON-BLOCKING):');
    result.warnings.forEach(warning => logger.info(`   ${warning}`));
    logger.info('');
  }
  
  if (result.passed) {
    logger.info('✅ All production readiness checks passed!');
    logger.info('   Application is ready to start.\n');
  } else {
    logger.info('❌ Production readiness checks FAILED!');
    logger.info('   Please fix the errors above before starting in production.\n');
  }
  
  logger.info('='.repeat(60) + '\n');
}

/**
 * Exécute la vérification et bloque le démarrage si nécessaire
 */
export function enforceProductionReadiness(): void {
  const result = checkProductionReadiness();
  displayCheckResults(result);
  
  // En production, bloquer le démarrage si des erreurs sont détectées
  if (process.env['NODE_ENV'] === 'production' && !result.passed) {
    logger.error('[Production Check] Production readiness check failed, exiting');
    process.exit(1);
  }
}

// Si exécuté directement (ESM compatible)
if (import.meta.url === `file://${process.argv[1]}`) {
  enforceProductionReadiness();
}
