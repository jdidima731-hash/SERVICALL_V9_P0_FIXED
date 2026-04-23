import React, { Component, ReactNode } from 'react';
import { AlertCircle  } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/**
 * ✅ CORRECTION PRODUCTION-READY: Composant de protection contre les crashes
 * Empêche les erreurs de propagation et affiche un fallback élégant
 */

interface SafeRenderProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface SafeRenderState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary pour capturer les erreurs de rendu React
 */
export class SafeRender extends Component<SafeRenderProps, SafeRenderState> {
  constructor(props: SafeRenderProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): SafeRenderState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[SafeRender] Caught error:', error, errorInfo);
    
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erreur d'affichage</AlertTitle>
          <AlertDescription>
            Une erreur est survenue lors de l'affichage de ce composant.
            {this.state.error && (
              <pre className="mt-2 text-xs overflow-auto">
                {this.state.error.message}
              </pre>
            )}
          </AlertDescription>
        </Alert>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook pour rendre de manière sécurisée avec try-catch
 */
export function useSafeRender<T>(
  renderFn: () => T,
  fallback: T
): T {
  try {
    return renderFn();
  } catch (error: any) {
    console.error('[useSafeRender] Error:', error);
    return fallback;
  }
}

/**
 * Composant pour rendre une liste de manière sécurisée
 */
interface SafeListProps<T> {
  items: T[] | null | undefined;
  renderItem: (item: T, index: number) => ReactNode;
  keyExtractor: (item: T, index: number) => string | number;
  emptyMessage?: string;
  // errorMessage?: string;
}

export function SafeList<T>({
  items,
  renderItem,
  keyExtractor,
  emptyMessage = 'Aucun élément à afficher',
  // errorMessage = 'Erreur lors de l\'affichage de la liste',
}: SafeListProps<T>) {
  // Protection contre null/undefined
  if (!items || !Array.isArray(items)) {
    return (
      <div className="text-center text-muted-foreground py-4">
        {emptyMessage}
      </div>
    );
  }

  // Liste vide
  if (items.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-4">
        {emptyMessage}
      </div>
    );
  }

  // Rendu sécurisé de chaque élément
  return (
    <>
      {items.map((item, index) => {
        if (!item) {
          return null;
        }

        try {
          const key = keyExtractor(item, index);
          return (
            <SafeRender key={key} fallback={null}>
              {renderItem(item, index)}
            </SafeRender>
          );
        } catch (error: any) {
          console.error('[SafeList] Error rendering item:', error, item);
          return null;
        }
      })}
    </>
  );
}

/**
 * Composant pour afficher des données avec protection
 */
interface SafeDataProps<T> {
  data: T | null | undefined;
  render: (data: T) => ReactNode;
  loading?: ReactNode;
  error?: ReactNode;
  empty?: ReactNode;
  isLoading?: boolean;
  isError?: boolean;
}

export function SafeData<T>({
  data,
  render,
  loading,
  error,
  empty,
  isLoading = false,
  isError = false,
}: SafeDataProps<T>) {
  // État de chargement
  if (isLoading) {
    return loading || (
      <div className="text-center text-muted-foreground py-4">
        Chargement...
      </div>
    );
  }

  // État d'erreur
  if (isError) {
    return error || (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Une erreur est survenue lors du chargement des données.
        </AlertDescription>
      </Alert>
    );
  }

  // Données absentes
  if (!data || data === null || data === undefined) {
    return empty || (
      <div className="text-center text-muted-foreground py-4">
        Aucune donnée disponible
      </div>
    );
  }

  // Rendu sécurisé des données
  try {
    return <SafeRender>{render(data)}</SafeRender>;
  } catch (error: any) {
    console.error('[SafeData] Error rendering data:', error);
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Erreur lors de l'affichage des données
        </AlertDescription>
      </Alert>
    );
  }
}
