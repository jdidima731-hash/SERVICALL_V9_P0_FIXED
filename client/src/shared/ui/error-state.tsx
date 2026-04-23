import { AlertCircleIcon, RefreshCwIcon  } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Button } from "./button";
import React, { Component, ReactNode } from "react";

interface ErrorStateProps {
  className?: string;
  title?: string;
  message?: string;
  error?: Error | { message: string } | string | null;
  onRetry?: () => void;
  showRetry?: boolean;
}

export function ErrorState({ 
  className,
  title = "Une erreur est survenue",
  message,
  error,
  onRetry,
  showRetry = true
}: ErrorStateProps) {
  // Extraire le message d'erreur
  let errorMessage = message;
  if (!errorMessage && error) {
    if (typeof error === "string") {
      errorMessage = error;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    } else if (error && typeof error === "object" && "message" in error) {
      errorMessage = (error as { message: string }).message;
    }
  }

  return (
    <div
      className={cn(
        "flex min-h-[400px] flex-col items-center justify-center gap-4 p-6 text-center",
        className
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-red-100 text-red-600">
        <AlertCircleIcon className="size-6" />
      </div>
      <div className="space-y-2 max-w-md">
        <h3 className="text-lg font-semibold">{title}</h3>
        {errorMessage && (
          <p className="text-sm text-muted-foreground">
            {errorMessage}
          </p>
        )}
      </div>
      {showRetry && onRetry && (
        <Button
          variant="outline"
          onClick={onRetry}
          className="gap-2"
        >
          <RefreshCwIcon className="size-4" />
          Réessayer
        </Button>
      )}
    </div>
  );
}

/**
 * LoadingFallback — Composant de fallback pour React.lazy et Suspense
 */
export function LoadingFallback({ message = "Chargement de la page..." }: { message?: string }) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

/**
 * ErrorBoundary — Composant de gestion des erreurs React (class component)
 * Exporté comme default pour compatibilité avec l'import dans main.tsx
 */
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <ErrorState
          title="Une erreur inattendue est survenue"
          error={this.state.error}
          onRetry={() => {
            this.setState({ hasError: false, error: undefined });
            window.location.reload();
          }}
        />
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
