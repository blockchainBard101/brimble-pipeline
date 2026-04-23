import { useQuery } from '@tanstack/react-query';
import { api, type Build } from '../lib/api';

export function useBuilds(deploymentId: string | null) {
  return useQuery<Build[]>({
    queryKey: ['builds', deploymentId],
    queryFn: () => api.deployments.getBuilds(deploymentId!),
    enabled: !!deploymentId,
  });
}
