import { AlertCircleIcon, RefreshCwIcon  } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Button } from "./button";

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
      errorMessage = error.message;
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
