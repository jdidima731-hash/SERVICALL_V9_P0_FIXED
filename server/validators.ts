import { z } from "zod";

/**
 * Validateurs Zod réutilisables pour la couche de données
 * Ces validateurs garantissent la cohérence et la sécurité des données
 */

// ============================================
// VALIDATEURS DE BASE
// ============================================

/**
 * Validation d'email avec format strict
 */
export const emailSchema = z
  .string()
  .transform(val => val.toLowerCase().trim())
  .pipe(
    z.string()
      .email("Format d'email invalide")
      .max(320, "L'email ne peut pas dépasser 320 caractères")
  );

/**
 * Validation de numéro de téléphone
 * Accepte les formats internationaux
 */
export const phoneSchema = z
  .string()
  .transform(val => val.trim())
  .pipe(
    z.string()
      .min(5, "Le numéro de téléphone est trop court")
      .max(20, "Le numéro de téléphone ne peut pas dépasser 20 caractères")
      .regex(
        /^[\+]?([0-9\(\)\-\.\s]){5,20}$/,
        "Format de téléphone invalide"
      )
  );

/**
 * Validation de nom (prénom/nom de famille)
 */
export const nameSchema = z
  .string()
  .transform(val => val.trim())
  .pipe(
    z.string()
      .min(1, "Le nom ne peut pas être vide")
      .max(100, "Le nom ne peut pas dépasser 100 caractères")
      .regex(/^[a-zA-ZÀ-ÿ\s\-']+$/, "Le nom contient des caractères invalides")
  );

/**
 * Validation de nom d'entreprise
 */
export const companySchema = z
  .string()
  .min(1, "Le nom de l'entreprise ne peut pas être vide")
  .max(255, "Le nom de l'entreprise ne peut pas dépasser 255 caractères")
  .transform(val => val.trim());

/**
 * Validation de notes/description
 */
export const notesSchema = z
  .string()
  .max(10000, "Les notes ne peuvent pas dépasser 10000 caractères")
  .transform(val => val.trim());

/**
 * Validation de titre
 */
export const titleSchema = z
  .string()
  .min(1, "Le titre ne peut pas être vide")
  .max(255, "Le titre ne peut pas dépasser 255 caractères")
  .transform(val => val.trim());

/**
 * Validation d'URL
 */
export const urlSchema = z
  .string()
  .url("Format d'URL invalide")
  .max(500, "L'URL ne peut pas dépasser 500 caractères");

/**
 * Validation de durée (en secondes)
 */
export const durationSchema = z
  .number()
  .int("La durée doit être un nombre entier")
  .min(0, "La durée ne peut pas être négative")
  .max(86400, "La durée ne peut pas dépasser 24 heures");

/**
 * Validation de score de qualité (0.00 à 10.00)
 */
export const qualityScoreSchema = z
  .string()
  .regex(/^\d{1,2}(\.\d{1,2})?$/, "Le score doit être un nombre décimal valide")
  .refine(val => {
    const num = parseFloat(val);
    return num >= 0 && num <= 10;
  }, "Le score doit être entre 0 et 10");

// ============================================
// VALIDATEURS D'ENUMS
// ============================================

export const prospectStatusSchema = z.enum(
  ["new", "contacted", "qualified", "converted", "lost"] as const
);

export const callTypeSchema = z.enum(["inbound", "outbound", "ai"] as const);

export const callDirectionSchema = z.enum(["incoming", "outgoing"] as const);

export const callStatusSchema = z.enum(
  ["pending", "active", "completed", "failed"] as const
);

export const appointmentStatusSchema = z.enum(
  ["scheduled", "confirmed", "completed", "cancelled", "rescheduled"] as const
);

export const sentimentSchema = z.enum(
  ["positive", "neutral", "negative", "mixed"] as const
);

// ============================================
// VALIDATEURS DE DATES
// ============================================

/**
 * Validation de date de début/fin avec vérification de cohérence
 */
export const dateRangeSchema = z
  .object({
    startTime: z.date(),
    endTime: z.date(),
  })
  .refine(data => data.endTime > data.startTime, {
    message: "La date de fin doit être après la date de début",
    path: ["endTime"],
  })
  .refine(
    data => {
      const diffMs = data.endTime.getTime() - data.startTime.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      return diffHours <= 24;
    },
    {
      message: "La durée ne peut pas dépasser 24 heures",
      path: ["endTime"],
    }
  );

/**
 * Validation de date future (pour les rendez-vous)
 */
export const futureDateSchema = z
  .date()
  .refine(date => date > new Date(), {
    message: "La date doit être dans le futur",
  });

// ============================================
// VALIDATEURS DE MÉTADONNÉES
// ============================================

/**
 * Validation de métadonnées JSON
 */
export const metadataSchema = z
  .record(z.string(), z.any())
  .optional()
  .refine(
    data => {
      if (!data) return true;
      const jsonString = JSON.stringify(data);
      return jsonString.length <= 65535; // Limite standard TEXT
    },
    {
      message: "Les métadonnées sont trop volumineuses",
    }
  );

// ============================================
// SCHÉMAS COMPOSÉS POUR LES ENTITÉS
// ============================================

/**
 * Schéma de validation complet pour la création de prospect
 */
export const createProspectSchema = z.object({
  tenantId: z.number().int().positive(),
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  company: companySchema.optional(),
  source: z.string().max(50).optional(),
  notes: notesSchema.optional(),
  metadata: metadataSchema,
});

/**
 * Schéma de validation complet pour la mise à jour de prospect
 */
export const updateProspectSchema = z.object({
  prospectId: z.number().int().positive(),
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  company: companySchema.optional(),
  status: prospectStatusSchema.optional(),
  notes: notesSchema.optional(),
  metadata: metadataSchema,
});

/**
 * Schéma de validation complet pour la création d'appel
 */
export const createCallSchema = z.object({
  tenantId: z.number().int().positive(),
  prospectId: z.number().int().positive().optional(),
  agentId: z.number().int().positive().optional(),
  callType: callTypeSchema,
  direction: callDirectionSchema,
  fromNumber: phoneSchema.optional(),
  toNumber: phoneSchema.optional(),
});

/**
 * Schéma de validation complet pour la mise à jour d'appel
 */
export const updateCallSchema = z.object({
  callId: z.number().int().positive(),
  status: callStatusSchema.optional(),
  duration: durationSchema.optional(),
  recordingUrl: urlSchema.optional(),
  recordingKey: z.string().max(255).optional(),
  transcription: z.string().max(65535).optional(),
  summary: z.string().max(65535).optional(),
  qualityScore: qualityScoreSchema.optional(),
  sentiment: sentimentSchema.optional(),
  metadata: metadataSchema,
});

/**
 * Schéma de validation complet pour la création de rendez-vous
 */
export const createAppointmentSchema = z
  .object({
    tenantId: z.number().int().positive(),
    prospectId: z.number().int().positive().optional(),
    agentId: z.number().int().positive().optional(),
    title: titleSchema,
    description: notesSchema.optional(),
    startTime: z.date({ message: "La date de début est requise" }),
    endTime: z.date({ message: "La date de fin est requise" }),
    location: z.string().max(255).optional(),
  })
  .refine(data => data.endTime > data.startTime, {
    message: "La date de fin doit être après la date de début",
    path: ["endTime"],
  });

/**
 * Schéma de validation complet pour la mise à jour de rendez-vous
 */
export const updateAppointmentSchema = z
  .object({
    appointmentId: z.number().int().positive(),
    title: titleSchema.optional(),
    description: notesSchema.optional(),
    startTime: z.date().optional(),
    endTime: z.date().optional(),
    status: appointmentStatusSchema.optional(),
    location: z.string().max(255).optional(),
    googleEventId: z.string().max(255).optional(),
    outlookEventId: z.string().max(255).optional(),
    reminderSent: z.boolean().optional(),
    confirmationSent: z.boolean().optional(),
  })
  .refine(
    data => {
      if (data.startTime && data.endTime) {
        return data.endTime > data.startTime;
      }
      return true;
    },
    {
      message: "La date de fin doit être après la date de début",
      path: ["endTime"],
    }
  );

// ============================================
// VALIDATEURS D'ID
// ============================================

/**
 * Validation d'ID positif
 */
export const idSchema = z.number().int().positive("L'ID doit être un nombre positif");

/**
 * Validation de tenant ID
 */
export const tenantIdSchema = z.object({
  tenantId: idSchema,
});

/**
 * Validation de prospect ID
 */
export const prospectIdSchema = z.object({
  prospectId: idSchema,
});

/**
 * Validation de call ID
 */
export const callIdSchema = z.object({
  callId: idSchema,
});

/**
 * Validation d'appointment ID
 */
export const appointmentIdSchema = z.object({
  appointmentId: idSchema,
});

// ============================================
// VALIDATEURS DE PAGINATION
// ============================================

/**
 * Schéma de pagination
 */
export const paginationSchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

/**
 * Schéma de recherche avec pagination
 */
export const searchSchema = paginationSchema.extend({
  query: z.string().max(255).optional(),
  sortBy: z.string().max(50).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// ============================================
// ✅ BLOC 6: VALIDATEURS ANTI CROSS-TENANT
// ============================================

/**
 * Middleware de validation Zod qui refuse tout tenantId dans les inputs
 * Le tenantId doit TOUJOURS provenir de la session (ctx.user.tenantId)
 */
export const rejectTenantIdInInput = z.object({}).strict().refine(
  (data: any) => {
    // Vérifier qu'aucune clé 'tenantId' n'existe dans l'input
    return !('tenantId' in data);
  },
  {
    message: "❌ SECURITY: tenantId cannot be provided in input. It must come from session context.",
  }
);

/**
 * Schéma de validation pour les requêtes qui NE DOIVENT PAS contenir de tenantId
 * Utilisé pour renforcer la sécurité anti cross-tenant
 */
export const noTenantIdSchema = z.object({
  tenantId: z.never().optional(),
}).passthrough();

/**
 * Helper pour créer un schéma qui refuse explicitement tenantId
 */
export function withoutTenantId<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.refine(
    (data: any) => !('tenantId' in data),
    {
      message: "❌ SECURITY: tenantId injection detected. This field is automatically set from session.",
      path: ['tenantId'],
    }
  );
}

/**
 * Validation stricte pour les opérations de mise à jour
 * Empêche l'injection de tenantId via params, query ou body
 */
export const secureUpdateSchema = <T extends z.ZodRawShape>(baseSchema: z.ZodObject<T>) => {
  return baseSchema.refine(
    (data: any) => {
      // Liste des champs interdits qui pourraient permettre une escalade de privilèges
      const forbiddenFields = ['tenantId', 'tenant_id', 'userId', 'user_id', 'role'];
      return !forbiddenFields.some(field => field in data);
    },
    {
      message: "❌ SECURITY: Forbidden field detected in input. System fields cannot be modified directly.",
    }
  );
};

/**
 * Validation de contexte tenant
 * Vérifie que le tenantId de la session correspond au tenantId attendu
 */
export const validateTenantContext = (sessionTenantId: number, resourceTenantId: number) => {
  if (sessionTenantId !== resourceTenantId) {
    throw new Error(
      `❌ CROSS-TENANT ACCESS DENIED: Session tenant ${sessionTenantId} attempted to access resource from tenant ${resourceTenantId}`
    );
  }
};

/**
 * Schéma pour les opérations de création avec injection automatique du tenantId
 */
export const secureCreateSchema = <T extends z.ZodRawShape>(
  baseSchema: z.ZodObject<T>
) => {
  return baseSchema
    .omit({ tenantId: true } as { tenantId: true } & Record<Exclude<'tenantId', keyof T>, never>)
    .refine(
      (data: any) => !('tenantId' in data),
      {
        message: "❌ SECURITY: tenantId will be automatically injected from session context.",
      }
    );
};

// ============================================
// EXEMPLES D'UTILISATION
// ============================================

/**
 * Exemple: Création de prospect sécurisée (sans tenantId dans l'input)
 */
export const secureCreateProspectSchema = z.object({
  // ❌ tenantId: z.number(), // INTERDIT - doit venir de ctx.user.tenantId
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  company: companySchema.optional(),
  source: z.string().max(50).optional(),
  notes: notesSchema.optional(),
  metadata: metadataSchema,
}).refine(
  (data: any) => !('tenantId' in data),
  {
    message: "❌ SECURITY: tenantId injection detected",
  }
);

/**
 * Exemple: Mise à jour de prospect sécurisée
 */
export const secureUpdateProspectSchema = z.object({
  prospectId: z.number().int().positive(),
  // ❌ tenantId: z.number(), // INTERDIT
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  company: companySchema.optional(),
  status: prospectStatusSchema.optional(),
  notes: notesSchema.optional(),
  metadata: metadataSchema,
}).refine(
  (data: any) => !('tenantId' in data),
  {
    message: "❌ SECURITY: tenantId injection detected",
  }
);
