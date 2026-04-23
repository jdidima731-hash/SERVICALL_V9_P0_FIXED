
import React from "react";
import { LoadingState } from "./ui/loading-state";

/**
 * Composant de fallback pour React.lazy et Suspense
 * Affiche un écran de chargement pendant le téléchargement du chunk
 */
export const LoadingFallback: React.FC<{ message?: string }> = ({ 
  message = "Chargement de la page..." 
}) => (
  <LoadingState fullScreen message={message} />
);

export default LoadingFallback;
