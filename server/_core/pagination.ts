import { z } from "zod";

export const paginationInput = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type PaginationInput = z.infer<typeof paginationInput>;

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export function paginate<T>(data: T[], total: number, input: PaginationInput): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / input.limit);
  return {
    data,
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages,
      hasNext: input.page < totalPages,
      hasPrev: input.page > 1,
    },
  };
}
