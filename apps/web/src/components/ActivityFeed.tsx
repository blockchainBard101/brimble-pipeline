import { useQuery } from '@tanstack/react-query';
import { api, type DeploymentEvent } from '../lib/api';
import { timeAgo } from '@/lib/time';

const ACTIVE_STATUSES = new Set(['pending', 'building', 'deploying', 'health_check', 'routing']);

const TYPE_DOT: Record<string, string> = {
  status_change: 'bg-zinc-500',
  build_complete: 'bg-emerald-500',
  health_check: 'bg-purple-500',
  route_added: 'bg-blue-500',
  rollback: 'bg-amber-500',
};

const TYPE_TEXT: Record<string, string> = {
  status_change: 'text-zinc-400',
  build_complete: 'text-emerald-400',
  health_check: 'text-purple-300',
  route_added: 'text-blue-300',
  rollback: 'text-amber-400',
};

export function ActivityFeed({
  deploymentId,
  status,
}: {
  deploymentId: string;
  status: string;
}) {
  const { data: events } = useQuery<DeploymentEvent[]>({
    queryKey: ['events', deploymentId],
    queryFn: () => api.deployments.getEvents(deploymentId),
    refetchInterval: ACTIVE_STATUSES.has(status) ? 2000 : false,
  });

  if (!events?.length) {
    return <p className="text-xs text-zinc-600 font-mono">No events yet.</p>;
  }

  return (
    <div className="relative pl-4 border-l border-zinc-800 space-y-2.5">
      {events.map((ev) => (
        <div key={ev.id} className="relative flex items-start gap-2.5 text-xs">
          <span
            className={`absolute -left-[17px] mt-1 w-2 h-2 rounded-full shrink-0 ${
              TYPE_DOT[ev.type] ?? 'bg-zinc-600'
            }`}
          />
          <span className="shrink-0 tabular-nums text-zinc-600 font-mono w-16">
            {timeAgo(ev.ts)}
          </span>
          <span className={TYPE_TEXT[ev.type] ?? 'text-zinc-300'}>{ev.message}</span>
        </div>
      ))}
    </div>
  );
}
