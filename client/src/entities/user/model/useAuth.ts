
import { trpc } from "@/shared/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useMemo } from "react";
import { encryptData } from "@/shared/utils/encryption";
import { isValidUser } from "@/shared/lib/safeAccess";
import { toast } from "sonner";

export function useAuth() {
  const utils = trpc.useUtils();

  const meQuery = trpc.core.auth.me.useQuery(undefined, {
    retry: (failureCount: number, error: unknown) => {
      if (error instanceof TRPCClientError && error.data?.code === "UNAUTHORIZED") {
        return false;
      }
      return failureCount < 1;
    },
    retryDelay: () => 500,
    refetchOnWindowFocus: true,
    staleTime: 5 * 60 * 1000,
  });

  const logoutMutation = trpc.core.auth.logout.useMutation({
    onSuccess: () => {
      utils.core.auth.me.setData(undefined, null);
      toast.success("Déconnexion réussie.");
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (error instanceof TRPCClientError && error.data?.code === "UNAUTHORIZED") return;
      toast.error("Erreur lors de la déconnexion.");
      throw error;
    } finally {
      utils.core.auth.me.setData(undefined, null);
      await utils.core.auth.me.invalidate();
      localStorage.removeItem("user-info");
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    let validUser = null;
    if (meQuery.data && isValidUser(meQuery.data)) {
      validUser = meQuery.data;
      const encrypted = encryptData(meQuery.data);
      if (encrypted) localStorage.setItem("user-info", encrypted);
    } else {
      localStorage.removeItem("user-info");
    }

    return {
      user: validUser,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(validUser),
    };
  }, [meQuery.data, meQuery.error, meQuery.isLoading, logoutMutation.error, logoutMutation.isPending]);

  return { ...state, refresh: () => meQuery.refetch(), logout };
}
