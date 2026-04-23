/**
 * COMPATIBILITÉ : re-export depuis l'emplacement FSD canonique
 * Les anciens imports @/contexts/TenantContext continuent de fonctionner.
 */
export { TenantProvider, useTenant } from "@/entities/tenant/model/TenantContext";
export type { } from "@/entities/tenant/model/TenantContext";
