/**
 * ✅ BLOC 3: Utilitaire pour transformer les erreurs techniques en messages user-friendly
 * 
 * Évite d'afficher des stack traces ou des messages techniques aux utilisateurs
 */

export function getUserFriendlyErrorMessage(error: unknown): string {
  // Si l'erreur est déjà un message simple, le retourner
  if (typeof error === 'string') {
    return error;
  }

  const errorMessage = (error !== null && typeof error === 'object' && 'message' in error) ? String((error as { message: unknown }).message) : '';

  // Erreurs d'authentification
  if (errorMessage.includes('UNAUTHORIZED') || errorMessage.includes('Unauthorized')) {
    return "Vous n'êtes pas autorisé à effectuer cette action. Veuillez vous reconnecter.";
  }

  // Erreurs de permissions
  if (errorMessage.includes('FORBIDDEN') || errorMessage.includes('Forbidden')) {
    return "Accès refusé : vous n'avez pas les permissions nécessaires.";
  }

  // Erreurs de validation
  if (errorMessage.includes('BAD_REQUEST') || errorMessage.includes('Invalid')) {
    return "Données invalides. Veuillez vérifier les champs et réessayer.";
  }

  // Erreurs de ressource non trouvée
  if (errorMessage.includes('NOT_FOUND') || errorMessage.includes('not found')) {
    return "La ressource demandée n'a pas été trouvée.";
  }

  // Erreurs de conflit (ex: doublon)
  if (errorMessage.includes('CONFLICT') || errorMessage.includes('already exists')) {
    return "Cette ressource existe déjà. Veuillez utiliser un autre nom.";
  }

  // Erreurs réseau
  if (errorMessage.includes('Network') || errorMessage.includes('fetch')) {
    return "Erreur de connexion. Veuillez vérifier votre connexion internet.";
  }

  // Erreurs de timeout
  if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
    return "L'opération a pris trop de temps. Veuillez réessayer.";
  }

  // Erreurs serveur
  if (errorMessage.includes('INTERNAL_SERVER_ERROR') || errorMessage.includes('500')) {
    return "Une erreur serveur est survenue. Veuillez réessayer plus tard.";
  }

  // Message générique si aucune correspondance
  return "Une erreur inattendue est survenue. Veuillez réessayer.";
}

/**
 * Variante pour les toasts avec titre et description
 */
export function getErrorToastContent(error: unknown): { title: string; description: string } {
  const userMessage = getUserFriendlyErrorMessage(error);
  
  return {
    title: "❌ Erreur",
    description: userMessage,
  };
}
