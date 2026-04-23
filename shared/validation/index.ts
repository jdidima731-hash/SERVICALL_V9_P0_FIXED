/**
 * Centralisation des Schémas de Validation Zod
 * 
 * Ce répertoire contient tous les schémas Zod utilisés pour valider et typer les données
 * à travers l'application. Ces schémas servent de "source de vérité unique" pour :
 * - La validation des entrées tRPC
 * - La génération de types TypeScript
 * - La validation au runtime
 * 
 * Structure :
 * - index.ts : Réexporte tous les schémas
 * - auth.ts : Schémas pour l'authentification et les utilisateurs
 * - crm.ts : Schémas pour les prospects, leads, contacts
 * - workflow.ts : Schémas pour les workflows et exécutions
 * - billing.ts : Schémas pour la facturation et les commandes
 * - common.ts : Schémas communs et réutilisables
 */

export * from './common';
export * from './auth';
export * from './crm';
export * from './workflow';
export * from './billing';
export * from './security';
export * from './recruitment';
