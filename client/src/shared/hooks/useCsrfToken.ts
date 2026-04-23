import { useEffect, useState, useCallback } from "react";

// ─── Store global ─────────────────────────────────────────────────────────────

export function getCsrfToken(): string | null {
  return (window as unknown as Record<string, unknown>)["__CSRF_TOKEN__"] as string | null ?? null;
}

export function setCsrfTokenGlobal(token: string | null): void {
  (window as unknown as Record<string, unknown>)["__CSRF_TOKEN__"] = token;
}

// ─── Fetcher partagé ──────────────────────────────────────────────────────────

async function fetchTokenFromServer(): Promise<string | null> {
  try {
    const response = await fetch("/api/csrf-token", {
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn("[CSRF] Échec serveur:", response.status);
      return null;
    }

    const data = await response.json() as { csrfToken?: string; csrfEnabled?: boolean };

    // Si le CSRF est désactivé côté serveur (dev ou CSRF_SECRET absent), on retourne null
    // et le tRPC client n'injectera pas de header — comportement correct.
    if (!data.csrfEnabled || !data.csrfToken) {
      return null;
    }

    return data.csrfToken;
  } catch (error: any) {
    console.error("[CSRF] Erreur réseau:", error);
    return null;
  }
}

// ─── Hook React ───────────────────────────────────────────────────────────────

export function useCsrfToken(): string | null {
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  const fetchCsrfToken = useCallback(async () => {
    const token = await fetchTokenFromServer();
    setCsrfToken(token);
    setCsrfTokenGlobal(token);
    if (token) {
      console.info("[CSRF] Token initialisé");
    }
  }, []);

  useEffect(() => {
    fetchCsrfToken();
  }, [fetchCsrfToken]);

  return csrfToken;
}

// ─── Refresh post-login ───────────────────────────────────────────────────────
//
// IMPORTANT : doit être appelé APRÈS que le cookie de session soit posé
// (le serveur pose le cookie servicall_session dans la réponse de login).
// Le délai de 300ms laisse au browser le temps de persister le cookie
// avant qu'on rappelle /api/csrf-token.

export async function refreshCsrfToken(): Promise<string | null> {
  // 1. Effacer l'ancien token immédiatement — évite qu'une requête entre-temps
  //    utilise le token périmé lié à l'ancienne session.
  setCsrfTokenGlobal(null);

  // 2. Délai pour s'assurer que le cookie de session est bien persisté
  //    avant que le serveur génère le nouveau token CSRF lié à cette session.
  await new Promise(resolve => setTimeout(resolve, 300));

  // 3. Récupérer le nouveau token lié à la nouvelle session
  const token = await fetchTokenFromServer();
  setCsrfTokenGlobal(token);

  if (token) {
    console.info("[CSRF] Token rafraîchi (post-login)");
  } else {
    console.info("[CSRF] Pas de token CSRF (protection désactivée)");
  }

  return token;
}
