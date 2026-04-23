import { type ReactNode } from "react";
import { useCsrfToken } from "@/hooks/useCsrfToken";

interface CsrfProviderProps {
  children: ReactNode;
}

/**
 * Provider centralisé pour la gestion du CSRF
 * Initialise automatiquement le token CSRF au démarrage de l'application via le hook useCsrfToken
 * Ce provider doit envelopper l'application pour garantir que le token est récupéré dès le montage.
 */
export function CsrfProvider({ children }: CsrfProviderProps) {
  // Le hook useCsrfToken s'occupe de fetcher le token et de le mettre dans le store global
  useCsrfToken();

  return <>{children}</>;
}
