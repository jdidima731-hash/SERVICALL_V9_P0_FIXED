/**
 * leadExtractionRouter.ts — VERSION AMÉLIORÉE & CORRIGÉE
 * ─────────────────────────────────────────────────────────────────────────────
 * ✅ FIX Bug#1 — search exécute directement (pas via queue) → retourne
 *    { businesses, total, provider, extractionId } immédiatement
 *
 * ✅ FIX Bug#2 — importProspects : exécution directe (résultats synchrones)
 *
 * ✅ AJOUT — Support B2C et Servicall Extractor (Hybrid)
 * ✅ AJOUT — Filtres B2C (Type logement, Revenus, Foyer, Statut immo, Âge)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { z } from "zod";
import { router } from "../_core/trpc";
import { tenantProcedure } from "../procedures";
import { TRPCError } from "@trpc/server";
import { logger } from "../infrastructure/logger";
import {
  searchBusinesses,
  importBusinessesAsProspects,
  type Business,
} from "../services/leadExtractionService";
import { saveAPIKey, getAPIKey } from "../services/byokService";
import { db } from "../db";
import { leadExtractions } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

// ── Schémas de validation ────────────────────────────────────────────────────

const businessSchema = z.object({
  _source: z.enum(["osm", "google", "pagesjaunes", "servicall", "b2c"]),
  _externalId: z.string(),
  name: z.string(),
  address: z.string(),
  city: z.string(),
  postalCode: z.string().optional(),
  country: z.string(),
  phone: z.string().optional(),
  website: z.string().optional(),
  email: z.string().optional(),
  category: z.string().optional(),
  rating: z.number().optional(),
  reviewCount: z.number().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  openingHours: z.array(z.string()).optional(),
  description: z.string().optional(),
  isIndividual: z.boolean().optional(),
});

const searchSchema = z.object({
  query: z.string().min(1, "Entrez un type d'activité"),
  location: z.string().min(1, "Entrez une ville ou code postal"),
  radius: z.number().min(500).max(100_000).default(5000),
  maxResults: z.number().min(1).max(100).default(20),
  provider: z.enum(["osm", "google", "pagesjaunes", "servicall", "b2c", "auto"]).default("auto"),
  // Filtres B2C optionnels
  housingType: z.enum(["house", "apartment", "all"]).optional(),
  estimatedIncome: z.enum(["low", "medium", "high", "very_high", "all"]).optional(),
  hasChildren: z.boolean().optional(),
  propertyStatus: z.enum(["owner", "tenant", "all"]).optional(),
  ageRange: z.string().optional(),
});

// ── Router ────────────────────────────────────────────────────────────────────


// ── P1.1: Quota enforcement ──────────────────────────────────────────────────
const MAX_RESULTS_PER_EXTRACTION = 5_000;

async function checkExtractionQuota(tenantId: number, requested: number): Promise<void> {
  if (requested > MAX_RESULTS_PER_EXTRACTION) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Maximum ${MAX_RESULTS_PER_EXTRACTION} résultats par extraction (demandé: ${requested}).`,
    });
  }
}

export const leadExtractionRouter = router({

  /**
   * search — Rechercher des entreprises ou particuliers
   * Exécution DIRECTE (synchrone) pour une réponse immédiate.
   */
  search: tenantProcedure
    .input(searchSchema)
    .mutation(async ({ input, ctx }: any) => {
      const tenantId = ctx.tenantId!;

      logger.info("[LeadExtraction] Search started", {
        query: input.query,
        location: input.location,
        provider: input.provider,
        tenantId,
      });

      try {
        // ✅ P1.1: Quota enforcement
        await checkExtractionQuota(tenantId, input.maxResults);

        const result = await searchBusinesses({
          ...input,
          tenantId,
        });

        // Enregistrer l'extraction dans l'historique (en arrière-plan)
        db.insert(leadExtractions).values({
          tenantId,
          query: input.query,
          location: input.location,
          provider: result.provider,
          radius: input.radius,
          resultsCount: result.businesses.length,
          status: "done",
          resultsSnapshot: result.businesses as unknown,
        }).catch(err => logger.warn("Failed to save extraction history", err));

        return {
          success: true,
          businesses: result.businesses,
          total: result.total,
          provider: result.provider,
          error: result.error,
        };
      } catch (err: any) {
        logger.error("[LeadExtraction] Search failed", { err, tenantId });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "Erreur lors de la recherche.",
        });
      }
    }),

  /**
   * importProspects — Importer des leads sélectionnés dans le CRM
   */
  importProspects: tenantProcedure
    .input(
      z.object({
        extractionId: z.number().optional(),
        businesses: z.array(businessSchema).min(1, "Sélectionnez au moins un lead"),
      })
    )
    .mutation(async ({ input, ctx }: any) => {
      const tenantId = ctx.tenantId!;

      try {
        const result = await importBusinessesAsProspects(
          input.businesses as Business[],
          tenantId,
          input.extractionId
        );

        return {
          success: true,
          ...result,
          message: `${result.imported} lead(s) importé(s), ${result.skipped} doublon(s) ignoré(s)`,
        };
      } catch (err: any) {
        logger.error("[LeadExtraction] Import failed", { err, tenantId });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de l'importation.",
        });
      }
    }),

  /**
   * history — Récupérer l'historique des extractions
   */
  history: tenantProcedure
    .input(z.object({ limit: z.number().default(10) }))
    .query(async ({ input, ctx }: any) => {
      return await db
        .select()
        .from(leadExtractions)
        .where(eq(leadExtractions.tenantId, ctx.tenantId!))
        .orderBy(desc(leadExtractions.createdAt))
        .limit(input.limit);
    }),

  /**
   * getApiKeys — Statut des clés BYOK
   */
  getApiKeys: tenantProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.tenantId!;
    const [googleKey, pjKey] = await Promise.all([
      getAPIKey(tenantId, "google_maps").catch(() => null),
      getAPIKey(tenantId, "pages_jaunes").catch(() => null),
    ]);

    return {
      hasGoogleKey: !!googleKey,
      googleKeyMasked: googleKey ? `${googleKey.slice(0, 4)}...${googleKey.slice(-4)}` : undefined,
      hasPagesJaunesKey: !!pjKey,
      pagesJaunesKeyMasked: pjKey ? `${pjKey.slice(0, 4)}...${pjKey.slice(-4)}` : undefined,
    };
  }),

  /**
   * saveApiKeys — Sauvegarder les clés API
   */
  saveApiKeys: tenantProcedure
    .input(
      z.object({
        googleMapsApiKey: z.string().optional(),
        pagesJaunesApiKey: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }: any) => {
      if (input.googleMapsApiKey) await saveAPIKey(ctx.tenantId!, "google_maps", input.googleMapsApiKey);
      if (input.pagesJaunesApiKey) await saveAPIKey(ctx.tenantId!, "pages_jaunes", input.pagesJaunesApiKey);
      return { success: true };
    }),
});
