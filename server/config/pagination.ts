/**
 * Pagination Configuration — Limites et validation
 * ✅ FIX P3.2: Standardise la pagination sur toutes les listes
 */

export const PAGINATION_DEFAULTS = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  MIN_LIMIT: 1,
};

export const PAGINATION_LIMITS = {
  PROSPECTS: { default: 20, max: 100 },
  CALLS: { default: 50, max: 200 },
  CAMPAIGNS: { default: 20, max: 100 },
  SUBSCRIPTIONS: { default: 20, max: 100 },
  WORKFLOWS: { default: 20, max: 100 },
  REPORTS: { default: 50, max: 500 },
  USERS: { default: 20, max: 100 },
};

/**
 * ✅ FIX P3.2: Valide et normalise les paramètres de pagination
 */
export function validatePagination(
  page?: number,
  limit?: number,
  maxLimit: number = PAGINATION_DEFAULTS.MAX_LIMIT
) {
  const p = Math.max(1, page || 1);
  const l = Math.min(
    Math.max(PAGINATION_DEFAULTS.MIN_LIMIT, limit || PAGINATION_DEFAULTS.DEFAULT_LIMIT),
    maxLimit
  );

  return {
    page: p,
    limit: l,
    offset: (p - 1) * l,
  };
}

/**
 * ✅ FIX P3.2: Retourne la réponse paginée formatée
 */
export function formatPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
) {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    },
  };
}
