/**
 * ✅ CORRECTION PRODUCTION-READY: Helpers défensifs pour accès sécurisé aux données
 * Empêche les crashes "Cannot read property 'id' of undefined"
 */

/**
 * Accès sécurisé à une propriété avec valeur par défaut
 * @example
 * const userId = safeGet(user, 'id', 0);
 * const userName = safeGet(user, 'name', 'Utilisateur');
 */
export function safeGet<T, K extends keyof T>(
  obj: T | null | undefined,
  key: K,
  defaultValue: T[K]
): T[K] {
  if (!obj || obj === null || obj === undefined) {
    return defaultValue;
  }
  const value = obj[key];
  return value !== null && value !== undefined ? value : defaultValue;
}

/**
 * Vérifier qu'un objet a toutes les propriétés requises
 * @example
 * if (hasRequiredProps(user, ['id', 'email', 'role'])) {
 *   // Safe to access user.id, user.email, user.role
 * }
 */
export function hasRequiredProps<T extends object>(
  obj: T | null | undefined,
  props: (keyof T)[]
): obj is T {
  if (!obj || obj === null || obj === undefined) {
    return false;
  }
  return props.every((prop) => {
    const value = obj[prop];
    return value !== null && value !== undefined;
  });
}

/**
 * Normaliser un tableau pour garantir qu'il n'est jamais null/undefined
 * @example
 * const calls = safeArray(data?.calls);
 * calls.map(...) // Safe
 */
export function safeArray<T>(arr: T[] | null | undefined): T[] {
  if (!arr || !Array.isArray(arr)) {
    return [];
  }
  return arr;
}

/**
 * Normaliser un objet pour garantir qu'il n'est jamais null/undefined
 * @example
 * const tenant = safeObject(data?.tenant, { id: 0, name: 'Default' });
 */
export function safeObject<T extends object>(
  obj: T | null | undefined,
  defaultValue: T
): T {
  if (!obj || obj === null || obj === undefined) {
    return defaultValue;
  }
  return obj;
}

/**
 * Accès sécurisé à une propriété imbriquée
 * @example
 * const city = safeNested(user, ['address', 'city'], 'Unknown');
 */
export function safeNested<T>(
  obj: unknown,
  path: string[],
  defaultValue: T
): T {
  if (!obj || obj === null || obj === undefined) {
    return defaultValue;
  }
  
  let current: unknown = obj;
  for (const key of path) {
    if (current === null || current === undefined || typeof current !== "object" || !(key in (current as object))) {
      return defaultValue;
    }
    current = (current as Record<string, unknown>)[key];
  }
  
  return current !== null && current !== undefined ? (current as unknown as T) : defaultValue;
}

/**
 * Mapper un tableau avec protection contre les éléments null/undefined
 * @example
 * const names = safeMap(users, (user: any) => user.name, 'Unknown');
 */
export function safeMap<T, R>(
  arr: T[] | null | undefined,
  mapper: (item: T, index: number) => R,
  defaultValue: R
): R[] {
  if (!arr || !Array.isArray(arr)) {
    return [];
  }
  
  return arr.map((item, index) => {
    if (item === null || item === undefined) {
      return defaultValue;
    }
    try {
      return mapper(item, index);
    } catch (error: any) {
      console.error('[SafeMap] Error mapping item:', error, item);
      return defaultValue;
    }
  });
}

/**
 * Filtrer un tableau avec protection contre les éléments null/undefined
 * @example
 * const activeUsers = safeFilter(users, (user: any) => user.isActive);
 */
export function safeFilter<T>(
  arr: T[] | null | undefined,
  predicate: (item: T, index: number) => boolean
): T[] {
  if (!arr || !Array.isArray(arr)) {
    return [];
  }
  
  return arr.filter((item, index) => {
    if (item === null || item === undefined) {
      return false;
    }
    try {
      return predicate(item, index);
    } catch (error: any) {
      console.error('[SafeFilter] Error filtering item:', error, item);
      return false;
    }
  });
}

/**
 * Trouver un élément dans un tableau avec protection
 * @example
 * const admin = safeFind(users, (user: any) => user.role === 'admin', null);
 */
export function safeFind<T>(
  arr: T[] | null | undefined,
  predicate: (item: T, index: number) => boolean,
  defaultValue: T | null = null
): T | null {
  if (!arr || !Array.isArray(arr)) {
    return defaultValue;
  }
  
  try {
    const found = arr.find((item, index) => {
      if (item === null || item === undefined) {
        return false;
      }
      return predicate(item, index);
    });
    return found !== undefined ? found : defaultValue;
  } catch (error: any) {
    console.error('[SafeFind] Error finding item:', error);
    return defaultValue;
  }
}

/**
 * Vérifier qu'un utilisateur a une session complète
 * @example
 * if (isValidUser(user)) {
 *   // user.id, user.role sont garantis
 * }
 */
export function isValidUser(user: unknown): user is { id: number; role: string; email: string } {
  if (typeof user !== "object" || user === null) return false;
  return hasRequiredProps(user as { id?: unknown; role?: unknown; email?: unknown }, ['id', 'role', 'email']);
}

/**
 * Vérifier qu'un tenant est valide
 * @example
 * if (isValidTenant(tenant)) {
 *   // tenant.id est garanti
 * }
 */
export function isValidTenant(tenant: unknown): tenant is { id: number; name: string } {
  if (typeof tenant !== "object" || tenant === null) return false;
  return hasRequiredProps(tenant as { id?: unknown; name?: unknown }, ['id', 'name']);
}
