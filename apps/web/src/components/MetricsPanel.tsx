import { useMetricsStream } from '../hooks/useMetricsStream';
import { formatUptime } from '@/lib/time';

function MetricBar({ percent, colorClass }: { percent: number; colorClass: string }) {
  return (
    <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-300 ${colorClass}`}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}

function memBarColor(percent: number): string {
  if (percent < 60) return 'bg-emerald-500';
  if (percent < 85) return 'bg-amber-500';
  return 'bg-red-500';
}

export function MetricsPanel({ deploymentId }: { deploymentId: string }) {
  const { metrics, connected } = useMetricsStream(deploymentId);

  if (!metrics && !connected) {
    return <p className="text-xs text-zinc-500 italic">Connecting to metrics…</p>;
  }
  if (!metrics) return null;

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/50 p-3 space-y-2.5 font-mono text-xs">
      <div className="flex items-center gap-3">
        <span className="w-10 shrink-0 text-zinc-500">CPU</span>
        <MetricBar percent={metrics.cpuPercent} colorClass="bg-blue-500" />
        <span className="w-12 text-right tabular-nums text-zinc-200">
          {metrics.cpuPercent.toFixed(1)}%
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="w-10 shrink-0 text-zinc-500">MEM</span>
        <MetricBar
          percent={metrics.memoryPercent}
          colorClass={memBarColor(metrics.memoryPercent)}
        />
        <span className="w-32 text-right tabular-nums text-zinc-200">
          {metrics.memoryUsageMB.toFixed(0)} / {metrics.memoryLimitMB.toFixed(0)} MB
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="w-10 shrink-0 text-zinc-500">UP</span>
        <span className="tabular-nums text-zinc-200">{formatUptime(metrics.uptimeSeconds)}</span>
      </div>
    </div>
  );
}
