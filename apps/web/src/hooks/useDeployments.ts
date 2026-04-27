import { useQuery } from '@tanstack/react-query';
import { api, type Deployment } from '../lib/api';

const TERMINAL = new Set<Deployment['status']>(['running', 'failed', 'stopped']);
const BUILDING = new Set<Deployment['status']>([
  'pending',
  'building',
  'deploying',
  'health_check',
  'routing',
]);

export function useDeployments() {
  const query = useQuery<Deployment[]>({
    queryKey: ['deployments'],
    queryFn: () => api.deployments.list(),
    refetchInterval: (q) => {
      const data = q.state.data;
      if (!data) return 3000;
      return data.some((d) => !TERMINAL.has(d.status)) ? 3000 : false;
    },
  });

  const stats = {
    running: query.data?.filter((d) => d.status === 'running').length ?? 0,
    building: query.data?.filter((d) => BUILDING.has(d.status)).length ?? 0,
    failed: query.data?.filter((d) => d.status === 'failed').length ?? 0,
  };

  return { ...query, stats };
}
