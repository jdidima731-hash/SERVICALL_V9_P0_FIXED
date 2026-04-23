/**
 * b2cLeadExtractionRouter.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Router tRPC pour le moteur B2C de recherche de particuliers qualifiés.
 *
 * Endpoints :
 *  search       — Rechercher des profils B2C par critères
 *  import       — Importer les profils sélectionnés dans le CRM
 *  getVerticals — Lister les secteurs disponibles
 *  getCriteria  — Retourner tous les critères filtrables
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { z } from "zod";
import { router } from "../_core/trpc";
import { tenantProcedure } from "../procedures";
import { TRPCError } from "@trpc/server";
import { logger } from "../infrastructure/logger";
import {
  searchB2CLeads,
  importB2CProfilesAsProspects,
  type B2CProfile,
} from "../services/b2cLeadExtractionService";

// ── Schémas de validation ────────────────────────────────────────────────────

const ageRangeSchema = z.enum(["18-25", "26-35", "36-45", "46-55", "56-65", "65+"]);
const incomeLevelSchema = z.enum(["modeste", "intermediaire", "confortable", "aise", "fortune"]);
const cspSchema = z.enum([
  "agriculteur", "artisan_commercant", "cadre_profession_liberale",
  "profession_intermediaire", "employe", "ouvrier", "retraite", "sans_emploi",
]);
const housingTypeSchema = z.enum(["proprietaire", "locataire", "hlm", "autre"]);
const familyStatusSchema = z.enum(["celibataire", "en_couple", "famille", "senior_seul"]);
const verticalSchema = z.enum([
  "immobilier", "assurance", "energie_renovation", "automobile",
  "credit_finance", "sante_mutuelle", "formation_emploi", "voyage_loisirs", "ecommerce_mode",
]);

const b2cProfileSchema = z.object({
  _source: z.string(),
  _profileId: z.string(),
  _commune: z.string(),
  _codePostal: z.string(),
  _departement: z.string(),
  _region: z.string(),
  ville: z.string(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  population: z.number(),
  densite: z.enum(["rural", "periurbain", "urbain", "metropole"]),
  ageRange: ageRangeSchema,
  csp: cspSchema,
  incomeLevel: incomeLevelSchema,
  revenuMedianAnnuel: z.number(),
  housingType: housingTypeSchema,
  familyStatus: familyStatusSchema,
  nbEnfants: z.enum(["0", "1", "2", "3+"]),
  niveauEtudes: z.enum(["bac-", "bac", "bac+2", "bac+3+", "grande_ecole"]),
  interests: z.array(z.object({
    category: z.string(),
    score: z.number(),
    signals: z.array(z.string()),
  })),
  qualificationScore: z.number(),
  qualificationLabel: z.enum(["chaud", "tiede", "froid"]),
  potentialByVertical: z.object({
    immobilier: z.number(), assurance: z.number(), energie_renovation: z.number(),
    automobile: z.number(), credit_finance: z.number(), sante_mutuelle: z.number(),
    formation_emploi: z.number(), voyage_loisirs: z.number(), ecommerce_mode: z.number(),
  }),
  tauxChomageLocal: z.number(),
  tauxProprietairesLocal: z.number(),
  revenuFiscalMedian: z.number(),
  indexPrecarite: z.number(),
});

// ── Router ────────────────────────────────────────────────────────────────────

export const b2cLeadExtractionRouter = router({

  /**
   * search — Rechercher des profils B2C par critères socio-démographiques
   */
  search: tenantProcedure
    .input(z.object({
      location: z.string().min(1, "Entrez une ville, un département ou une région"),
      ageRanges: z.array(ageRangeSchema).optional(),
      incomeLevels: z.array(incomeLevelSchema).optional(),
      csps: z.array(cspSchema).optional(),
      housingTypes: z.array(housingTypeSchema).optional(),
      familyStatuses: z.array(familyStatusSchema).optional(),
      interests: z.array(z.string()).optional(),
      vertical: verticalSchema.optional(),
      minVerticalScore: z.number().min(0).max(100).optional(),
      minQualificationScore: z.number().min(0).max(100).optional(),
      maxResults: z.number().min(1).max(200).default(50),
    }))
    .mutation(async ({ input, ctx }: any) => {
      const tenantId = ctx.tenantId!;

      logger.info("[B2CRouter] Search started", {
        location: input.location,
        vertical: input.vertical,
        tenantId,
      });

      try {
        const result = await searchB2CLeads({ ...input, tenantId });
        return {
          success: true,
          profiles: result.profiles,
          total: result.total,
          communesAnalysees: result.communesAnalysees,
          source: result.source,
          stats: result.stats,
          error: result.error,
        };
      } catch (err: any) {
        logger.error("[B2CRouter] Search failed", { err, tenantId });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "Erreur lors de la recherche B2C.",
        });
      }
    }),

  /**
   * importProspects — Importer les profils B2C sélectionnés dans le CRM
   */
  importProspects: tenantProcedure
    .input(z.object({
      profiles: z.array(b2cProfileSchema).min(1).max(200),
    }))
    .mutation(async ({ input, ctx }: any) => {
      const tenantId = ctx.tenantId!;

      logger.info("[B2CRouter] Import started", {
        count: input.profiles.length,
        tenantId,
      });

      try {
        const result = await importB2CProfilesAsProspects(input.profiles as B2CProfile[], tenantId);
        return {
          success: true,
          imported: result.imported,
          skipped: result.skipped,
          errors: result.errors,
          message: `${result.imported} profil(s) importé(s), ${result.skipped} doublon(s)`,
        };
      } catch (err: any) {
        logger.error("[B2CRouter] Import failed", { err, tenantId });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "Erreur lors de l'import.",
        });
      }
    }),

  /**
   * getCriteria — Retourner tous les critères filtrables avec labels
   */
  getCriteria: tenantProcedure.query(() => ({
    ageRanges: [
      { value: "18-25", label: "18-25 ans" },
      { value: "26-35", label: "26-35 ans" },
      { value: "36-45", label: "36-45 ans" },
      { value: "46-55", label: "46-55 ans" },
      { value: "56-65", label: "56-65 ans" },
      { value: "65+",   label: "65 ans et plus" },
    ],
    incomeLevels: [
      { value: "modeste",        label: "Modeste (< 18k€/an)",        color: "bg-red-100 text-red-700" },
      { value: "intermediaire",  label: "Intermédiaire (18-30k€/an)", color: "bg-orange-100 text-orange-700" },
      { value: "confortable",    label: "Confortable (30-50k€/an)",   color: "bg-yellow-100 text-yellow-700" },
      { value: "aise",           label: "Aisé (50-80k€/an)",          color: "bg-green-100 text-green-700" },
      { value: "fortune",        label: "Fortuné (> 80k€/an)",        color: "bg-purple-100 text-purple-700" },
    ],
    csps: [
      { value: "cadre_profession_liberale", label: "Cadre / Profession libérale" },
      { value: "profession_intermediaire",  label: "Profession intermédiaire" },
      { value: "employe",                   label: "Employé" },
      { value: "ouvrier",                   label: "Ouvrier" },
      { value: "artisan_commercant",        label: "Artisan / Commerçant" },
      { value: "agriculteur",               label: "Agriculteur" },
      { value: "retraite",                  label: "Retraité" },
      { value: "sans_emploi",               label: "Sans emploi" },
    ],
    housingTypes: [
      { value: "proprietaire", label: "Propriétaire", icon: "🏠" },
      { value: "locataire",    label: "Locataire",    icon: "🔑" },
      { value: "hlm",          label: "HLM / Social", icon: "🏢" },
    ],
    familyStatuses: [
      { value: "celibataire",  label: "Célibataire",     icon: "👤" },
      { value: "en_couple",    label: "En couple",        icon: "👫" },
      { value: "famille",      label: "Famille",          icon: "👨‍👩‍👧" },
      { value: "senior_seul",  label: "Senior seul(e)",   icon: "👴" },
    ],
    verticals: [
      { value: "immobilier",        label: "Immobilier",       icon: "🏠", color: "blue" },
      { value: "assurance",         label: "Assurance",        icon: "🛡️", color: "indigo" },
      { value: "energie_renovation",label: "Énergie / Réno",   icon: "⚡", color: "yellow" },
      { value: "automobile",        label: "Automobile",       icon: "🚗", color: "gray" },
      { value: "credit_finance",    label: "Crédit / Finance", icon: "💳", color: "green" },
      { value: "sante_mutuelle",    label: "Santé / Mutuelle", icon: "🏥", color: "red" },
      { value: "formation_emploi",  label: "Formation",        icon: "📚", color: "orange" },
      { value: "voyage_loisirs",    label: "Voyage / Loisirs", icon: "✈️", color: "cyan" },
      { value: "ecommerce_mode",    label: "E-commerce",       icon: "🛒", color: "pink" },
    ],
    interests: [
      "immobilier", "assurance", "energie_renovation", "automobile",
      "credit_finance", "sante_mutuelle", "formation_emploi", "voyage_loisirs", "ecommerce_mode",
    ],
  })),
});
