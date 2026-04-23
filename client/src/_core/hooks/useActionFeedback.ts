/**
 * Hook personnalisé pour gérer le feedback des actions CRUD
 * Fournit des notifications toast et des états de chargement
 */

import { useState, useCallback } from "react";
import { toast } from "sonner";

export interface ActionFeedbackOptions {
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export interface ActionFeedbackState {
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook pour gérer le feedback des actions asynchrones
 * @example
 * const { isLoading, execute } = useActionFeedback({
 *   successMessage: "Prospect créé avec succès",
 *   errorMessage: "Erreur lors de la création"
 * });
 *
 * const handleCreate = async () => {
 *   await execute(async () => {
 *     await createProspect(data);
 *   });
 * };
 */
export function useActionFeedback(options: ActionFeedbackOptions = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(
    async (action: () => Promise<void>) => {
      setIsLoading(true);
      setError(null);

      try {
        await action();

        if (options.successMessage) {
          toast.success(options.successMessage);
        }

        options.onSuccess?.();
      } catch (err: any) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);

        const errorMsg =
          options.errorMessage || error.message || "Une erreur s'est produite";
        toast.error(errorMsg);

        options.onError?.(error);
      } finally {
        setIsLoading(false);
      }
    },
    [options]
  );

  return {
    isLoading,
    error,
    execute,
  };
}

/**
 * Hook pour gérer les confirmations de suppression
 * @example
 * const { isOpen, confirm } = useConfirmDelete({
 *   onConfirm: async () => {
 *     await deleteProspect(id);
 *   }
 * });
 */
export function useConfirmDelete(options: {
  onConfirm: () => Promise<void>;
  itemName?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { isLoading, execute } = useActionFeedback({
    successMessage: `${options.itemName || "Élément"} supprimé avec succès`,
    errorMessage: `Erreur lors de la suppression de ${options.itemName || "l'élément"}`,
    onSuccess: () => setIsOpen(false),
  });

  const confirm = useCallback(async () => {
    await execute(options.onConfirm);
  }, [execute, options]);

  return {
    isOpen,
    setIsOpen,
    isLoading,
    confirm,
  };
}

/**
 * Hook pour gérer les formulaires avec feedback
 * @example
 * const { isSubmitting, handleSubmit } = useFormFeedback({
 *   onSubmit: async (data: any) => {
 *     await createProspect(data);
 *   },
 *   successMessage: "Prospect créé"
 * });
 */
export function useFormFeedback(options: {
  onSubmit: (data: unknown) => Promise<void>;
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = useCallback(
    async (data: unknown) => {
      setIsSubmitting(true);
      setErrors({});

      try {
        await options.onSubmit(data);

        if (options.successMessage) {
          toast.success(options.successMessage);
        }

        options.onSuccess?.();
      } catch (err: any) {
        const error = err instanceof Error ? err : new Error(String(err));
        const errorMsg = options.errorMessage || error.message;

        toast.error(errorMsg);
        setErrors({ submit: errorMsg });
      } finally {
        setIsSubmitting(false);
      }
    },
    [options]
  );

  return {
    isSubmitting,
    errors,
    handleSubmit,
  };
}

/**
 * Hook pour gérer les opérations en batch
 * @example
 * const { isProcessing, processBatch } = useBatchFeedback();
 *
 * const handleDeleteMultiple = async (ids: number[]) => {
 *   await processBatch(
 *     ids.map((id: any) => () => deleteProspect(id)),
 *     `${ids.length} prospects supprimés`
 *   );
 * };
 */
export function useBatchFeedback() {
  const [isProcessing, setIsProcessing] = useState(false);

  const processBatch = useCallback(
    async (
      actions: Array<() => Promise<void>>,
      successMessage?: string
    ) => {
      setIsProcessing(true);

      try {
        for (const action of actions) {
          await action();
        }

        if (successMessage) {
          toast.success(successMessage);
        }
      } catch (err: any) {
        const error = err instanceof Error ? err : new Error(String(err));
        toast.error(error.message);
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  return {
    isProcessing,
    processBatch,
  };
}
