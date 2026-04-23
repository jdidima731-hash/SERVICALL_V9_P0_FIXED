import { trpc } from "@/lib/trpc";

/**
 * Interface pour les compteurs de badges de la sidebar
 */
export interface SidebarBadges {
  prospects: number;
  calls: number;
  appointments: number;
  workflows: number;
}

/**
 * Hook personnalisé pour récupérer les compteurs de badges de la sidebar
 * ✅ FIX: retry:false et refetchOnWindowFocus:false pour éviter les timeouts de 30s
 * 
 * @returns Les compteurs de badges pour chaque section de la sidebar
 */
export function useSidebarBadges(): SidebarBadges {
  // ✅ FIX: Options optimisées pour éviter les timeouts en cascade
  const queryOptions = {
    refetchInterval: 60000,      // 60s au lieu de 30s pour réduire la charge
    refetchOnWindowFocus: false, // Désactivé pour éviter les requêtes inutiles
    staleTime: 50000,
    retry: false,                // Pas de retry pour éviter les timeouts en cascade
    retryOnMount: false,
  } as const;

  // Compteur de nouveaux prospects
  const prospectsQuery = trpc.business.prospect.getBadgeCount.useQuery(undefined, queryOptions);
  const prospectsCount = prospectsQuery.data ?? 0;

  // Compteur d'appels en attente
  const callsQuery = trpc.communication.calls.getBadgeCount.useQuery(undefined, queryOptions);
  const callsCount = callsQuery.data ?? 0;

  // Compteur de rendez-vous du jour
  const appointmentsQuery = trpc.business.appointment.getBadgeCount.useQuery(undefined, queryOptions);
  const appointmentsCount = appointmentsQuery.data ?? 0;

  // Pour l'instant, workflows n'a pas de compteur spécifique
  const workflowsCount = 0;

  return {
    prospects: prospectsCount,
    calls: callsCount,
    appointments: appointmentsCount,
    workflows: workflowsCount,
  };
}
