/**
 * logging-utils.ts
 * ✅ R4: deepClone type-safe — remplace JSON.parse(JSON.stringify())
 */

/**
 * deepClone — Clone profond type-safe.
 * Gère undefined, types primitifs, arrays, objets imbriqués.
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) ;
  if (Array.isArray(obj)) return (obj ).map((item: any) => deepClone(item)) ;
  const clone: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    clone[k] = deepClone(v);
  }
  return clone as T;
}

/**
 * maskSensitive — Masque les champs sensibles dans un objet pour les logs.
 * ✅ Type-safe: <T extends Record<string, unknown>> au lieu de any.
 */
export function maskSensitive<T extends Record<string, unknown>>(
  obj: T,
  fields: string[] = ['apiKey', 'secret', 'token', 'password', 'authorization']
): T {
  const masked = deepClone(obj);
  const mask = (target: Record<string, unknown>, depth = 0): void => {
    if (depth > 5) return; // limite de récursion
    for (const key of Object.keys(target)) {
      if (fields.some(f => key.toLowerCase().includes(f.toLowerCase()))) {
        const val = target[key];
        if (typeof val === "string") {
          target[key] = val.length > 8 ? `${val.slice(0, 4)}...${val.slice(-4)}` : "***";
        }
      } else if (target[key] && typeof target[key] === "object" && !Array.isArray(target[key])) {
        mask(target[key] as Record<string, unknown>, depth + 1);
      }
    }
  };
  mask(masked );
  return masked;
}
