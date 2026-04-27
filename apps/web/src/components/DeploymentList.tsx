import { useDeployments } from '../hooks/useDeployments';
import { DeploymentCard } from './DeploymentCard';
import { Skeleton } from '@/components/ui/skeleton';

function LoadingSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="border-b border-zinc-800 py-3.5 space-y-2.5">
          <div className="flex items-center gap-2.5">
            <Skeleton className="w-16 h-3.5 bg-zinc-800 rounded-full" />
            <Skeleton className="w-36 h-3.5 bg-zinc-800" />
            <Skeleton className="w-10 h-3 bg-zinc-800 ml-auto" />
          </div>
          <Skeleton className="w-52 h-3 bg-zinc-800" />
        </div>
      ))}
    </div>
  );
}

export function DeploymentList() {
  const { data, isLoading, isError } = useDeployments();

  return (
    <div>
      <div className="sticky top-0 h-9 flex items-center gap-2 border-b border-zinc-800 bg-zinc-950 z-10">
        <span className="text-[11px] font-mono font-semibold text-zinc-500 uppercase tracking-wider">
          Deployments
        </span>
        {data != null && (
          <span className="text-[11px] font-mono text-zinc-700">({data.length})</span>
        )}
      </div>

      {isLoading && <LoadingSkeleton />}

      {isError && (
        <p className="text-xs text-red-400 font-mono mt-4">Failed to load deployments.</p>
      )}

      {!isLoading && !isError && !data?.length && (
        <p className="text-xs text-zinc-600 font-mono mt-4">No deployments yet.</p>
      )}

      {data?.map((d) => (
        <DeploymentCard key={d.id} deployment={d} />
      ))}
    </div>
  );
}
