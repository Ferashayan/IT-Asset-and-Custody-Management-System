import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';

/**
 * Wraps a mutation with success/error toasts and cache invalidation.
 * `fn` should return the `{ data, message }` object from api.post/put/delete.
 */
export function useApiMutation<TVars, TData = unknown>(
  fn: (vars: TVars) => Promise<{ data: TData; message: string }>,
  options: { invalidate?: QueryKey[]; onSuccess?: (data: TData, vars: TVars) => void } = {},
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (result, vars) => {
      toast.success(result.message);
      await Promise.all((options.invalidate ?? []).map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      options.onSuccess?.(result.data, vars);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
