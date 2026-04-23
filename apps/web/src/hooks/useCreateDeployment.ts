import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type CreateDeploymentPayload } from '../lib/api';

export function useCreateDeployment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateDeploymentPayload) => api.deployments.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['deployments'] });
    },
  });
}
