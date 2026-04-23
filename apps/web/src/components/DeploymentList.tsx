import { useDeployments } from '../hooks/useDeployments';
import { DeploymentCard } from './DeploymentCard';

export function DeploymentList() {
  const { data, isLoading, isError } = useDeployments();

  if (isLoading) return <p className="text-sm text-gray-500">Loading deployments…</p>;
  if (isError) return <p className="text-sm text-red-400">Failed to load deployments.</p>;
  if (!data?.length) return <p className="text-sm text-gray-500">No deployments yet.</p>;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Deployments</h2>
      {data.map((d) => (
        <DeploymentCard key={d.id} deployment={d} />
      ))}
    </div>
  );
}
