import { useEffect, useState } from "react";
import { Loader2Icon, AlertTriangleIcon  } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface LoadingStateProps {
  className?: string;
  message?: string;
  timeout?: number; // en millisecondes, par défaut 10000 (10s)
  onTimeout?: () => void;
}

export function LoadingState({ 
  className, 
  message = "Chargement en cours...",
  timeout = 10000,
  onTimeout
}: LoadingStateProps) {
  const [isTimedOut, setIsTimedOut] = useState(false);

  useEffect(() => {
    if (!timeout) return;

    const timer = setTimeout(() => {
      setIsTimedOut(true);
      onTimeout?.();
    }, timeout);

    return () => clearTimeout(timer);
  }, [timeout, onTimeout]);

  if (isTimedOut) {
    return (
      <div
        className={cn(
          "flex min-h-[400px] flex-col items-center justify-center gap-4 p-6 text-center",
          className
        )}
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-yellow-100 text-yellow-600">
          <AlertTriangleIcon className="size-6" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Le chargement prend plus de temps que prévu</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            La requête semble prendre trop de temps. Veuillez vérifier votre connexion ou réessayer.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => window.location.reload()}
        >
          Recharger la page
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-[400px] flex-col items-center justify-center gap-4 p-6 text-center",
        className
      )}
    >
      <Loader2Icon className="size-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
