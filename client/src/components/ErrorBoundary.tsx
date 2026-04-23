import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw  } from 'lucide-react';
import React, { Component, ReactNode } from "react";
import * as Sentry from "@sentry/react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // ✅ Bloc 9: Capture Sentry pour les erreurs UI non gérées
    Sentry.withScope((scope) => {
      scope.setExtras(errorInfo as unknown as Record<string, unknown>);
      Sentry.captureException(error);
    });
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
            />

            <h2 className="text-2xl font-bold mb-2">Oups ! Une erreur est survenue.</h2>
            <p className="text-muted-foreground mb-6 text-center">
              L'application a rencontré un problème inattendu. Nous nous excusons pour la gêne occasionnée.
            </p>

            <div className="p-4 w-full rounded-lg bg-muted/50 border overflow-auto mb-8 max-h-[300px]">
              <p className="font-semibold text-sm mb-2 text-destructive">Détails de l'erreur :</p>
              <pre className="text-xs text-muted-foreground whitespace-break-spaces font-mono">
                {this.state.error?.message}
                {"\n\n"}
                {this.state.error?.stack}
              </pre>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => window.location.href = "/dashboard"}
                className={cn(
                  "flex items-center gap-2 px-6 py-2.5 rounded-full font-medium transition-all",
                  "bg-secondary text-secondary-foreground",
                  "hover:bg-secondary/80 cursor-pointer"
                )}
              >
                Retour au Dashboard
              </button>
              <button
                onClick={() => window.location.reload()}
                className={cn(
                  "flex items-center gap-2 px-6 py-2.5 rounded-full font-medium transition-all",
                  "bg-primary text-primary-foreground shadow-lg shadow-primary/20",
                  "hover:opacity-90 cursor-pointer"
                )}
              >
                <RotateCcw size={16} />
                Recharger la page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
