import { z } from 'zod';
import { IdSchema, EmailSchema, RoleEnum, DateSchema } from './common';

/**
 * Schémas Zod pour l'Authentification et les Utilisateurs
 * 
 * Définit les types pour les opérations liées aux utilisateurs,
 * à l'authentification et à la gestion des sessions.
 */

// ============================================
// UTILISATEURS
// ============================================

export const UserBaseSchema = z.object({
  id: IdSchema,
  openId: z.string().min(1, 'OpenID requis'),
  name: z.string().min(1, 'Nom requis').optional().nullable(),
  email: EmailSchema.optional().nullable(),
  role: RoleEnum,
  isActive: z.boolean().default(true),
  createdAt: DateSchema.optional().nullable(),
  updatedAt: DateSchema.optional().nullable(),
});

export const UserCreateSchema = z.object({
  openId: z.string().min(1, 'OpenID requis'),
  name: z.string().min(1, 'Nom requis').optional(),
  email: EmailSchema.optional(),
  role: RoleEnum.default('user'),
});

export const UserUpdateSchema = z.object({
  name: z.string().min(1, 'Nom requis').optional(),
  email: EmailSchema.optional(),
  role: RoleEnum.optional(),
  isActive: z.boolean().optional(),
});

export const UserSchema = UserBaseSchema;

// ============================================
// AUTHENTIFICATION
// ============================================

export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
});

export const SignupSchema = z.object({
  email: EmailSchema,
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  name: z.string().min(1, 'Nom requis'),
});

export const PasswordResetSchema = z.object({
  email: EmailSchema,
});

export const PasswordUpdateSchema = z.object({
  currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
  newPassword: z.string().min(8, 'Le nouveau mot de passe doit contenir au moins 8 caractères'),
});

// ============================================
// SESSIONS ET TOKENS
// ============================================

export const SessionSchema = z.object({
  id: z.string(),
  userId: IdSchema,
  tenantId: IdSchema,
  expiresAt: DateSchema,
  createdAt: DateSchema,
});

export const TokenSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  expiresIn: z.number().int().positive(),
  tokenType: z.enum(['Bearer']).default('Bearer'),
});

export const AuthResponseSchema = z.object({
  user: UserSchema,
  token: TokenSchema,
});

// ============================================
// TYPES GÉNÉRÉS
// ============================================

export type User = z.infer<typeof UserSchema>;
export type UserCreate = z.infer<typeof UserCreateSchema>;
export type UserUpdate = z.infer<typeof UserUpdateSchema>;
export type Login = z.infer<typeof LoginSchema>;
export type Signup = z.infer<typeof SignupSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type Token = z.infer<typeof TokenSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

// Schémas migrés depuis validators/user.ts
export const userSchema = z.object({
  id: z.number(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  role: z.string().nullable(),
  isActive: z.boolean().nullable(),
});

export const teamMemberSchema = z.object({
  id: z.number(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  role: z.string().nullable(),
  isActive: z.boolean().nullable(),
});

export const paginatedTeamMemberSchema = z.object({
  data: z.array(teamMemberSchema),
  pagination: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    totalPages: z.number(),
  }),
});

export const teamKPIsSchema = z.object({
  totalMembers: z.number(),
  activeAgents: z.number(),
  teamPerformance: z.number(),
  alerts: z.array(z.object({
    id: z.number(),
    type: z.string(),
    message: z.string(),
  })),
});

export type UserSchemaType = z.infer<typeof userSchema>;
export type TeamMember = z.infer<typeof teamMemberSchema>;
export type TeamKPIs = z.infer<typeof teamKPIsSchema>;
