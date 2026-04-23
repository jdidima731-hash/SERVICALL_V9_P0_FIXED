import { UseQueryResult } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";

export type QueryState = "loading" | "error" | "empty" | "success" | "forbidden";

interface UseQueryStateResult {
  state: QueryState;
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  isSuccess: boolean;
  isForbidden: boolean;
  error: Error | null;
  errorCode?: string;
}

/**
 * Hook to normalize query states from tRPC queries
 * Helps manage: loading, error, empty, forbidden, success states
 */
export function useQueryState<T>(
  query: UseQueryResult<T | null | undefined, unknown>
): UseQueryStateResult {
  const isLoading = query.isLoading || query.isFetching;
  const isError = query.isError;
  const error = query.error as Error | TRPCClientError<any> | null;
  const isForbidden = error instanceof TRPCClientError && (error as TRPCClientError<any>).data?.code === "FORBIDDEN";
  const isEmpty = !isLoading && !isError && !query.data;
  const isSuccess = !isLoading && !isError && !!query.data;

  let state: QueryState = "loading";
  if (isLoading) state = "loading";
  else if (isForbidden) state = "forbidden";
  else if (isError) state = "error";
  else if (isEmpty) state = "empty";
  else state = "success";

  return {
    state,
    isLoading,
    isError,
    isEmpty,
    isSuccess,
    isForbidden,
    error: error as Error | null,
    errorCode: error instanceof TRPCClientError ? error.data?.code : undefined,
  };
}
