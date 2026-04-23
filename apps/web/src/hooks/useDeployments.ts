import { useQuery } from '@tanstack/react-query';
import { api, type Deployment } from '../lib/api';

const TERMINAL = new Set<Deployment['status']>(['running', 'failed', 'stopped']);

export function useDeployments() {
  return useQuery<Deployment[]>({
    queryKey: ['deployments'],
    queryFn: () => api.deployments.list(),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 3000;
      return data.some((d) => !TERMINAL.has(d.status)) ? 3000 : false;
    },
  });
}
