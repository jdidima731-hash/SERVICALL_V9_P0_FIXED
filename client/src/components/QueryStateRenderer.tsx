
import React from "react";
import { QueryState } from "@/_core/hooks/useQueryState";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";

interface QueryStateRendererProps {
  state: QueryState;
  error?: Error | null;
  errorCode?: string;
  children: React.ReactNode;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  onRetry?: () => void;
}

export function QueryStateRenderer({
  state,
  error,
  errorCode,
  children,
  emptyTitle,
  emptyMessage,
  emptyActionLabel,
  onEmptyAction,
  onRetry,
}: QueryStateRendererProps) {
  switch (state) {
    case "loading":
      return <LoadingState />;
    
    case "forbidden":
      return <ForbiddenState />;
    
    case "error":
      return (
        <ErrorState
          title="Erreur lors du chargement"
          message={error?.message || "Une erreur est survenue. Veuillez réessayer."}
          code={errorCode}
          onRetry={onRetry}
        />
      );
    
    case "empty":
      return (
        <EmptyState
          title={emptyTitle}
          message={emptyMessage}
          actionLabel={emptyActionLabel}
          onAction={onEmptyAction}
        />
      );
    
    case "success":
      return <>{children}</>;
    
    default:
      return <>{children}</>;
  }
}
