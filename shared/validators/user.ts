import { z } from "zod";

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
