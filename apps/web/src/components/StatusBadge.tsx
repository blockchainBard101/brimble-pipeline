type Status = string;

interface StatusConfig {
  dot: string;
  text: string;
  label: string;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  pending:      { dot: 'bg-zinc-500',                        text: 'text-zinc-500',   label: 'pending' },
  building:     { dot: 'bg-amber-500 animate-pulse',         text: 'text-amber-500',  label: 'building' },
  deploying:    { dot: 'bg-blue-500 animate-pulse',          text: 'text-blue-500',   label: 'deploying' },
  health_check: { dot: 'bg-blue-500 animate-pulse',          text: 'text-blue-500',   label: 'health check' },
  routing:      { dot: 'bg-blue-500 animate-pulse',          text: 'text-blue-500',   label: 'routing' },
  running:      { dot: 'bg-emerald-500',                     text: 'text-emerald-500', label: 'running' },
  failed:       { dot: 'bg-red-500',                         text: 'text-red-500',    label: 'failed' },
  stopped:      { dot: 'bg-zinc-600',                        text: 'text-zinc-600',   label: 'stopped' },
};

const FALLBACK: StatusConfig = { dot: 'bg-zinc-600', text: 'text-zinc-500', label: 'unknown' };

export function StatusBadge({ status }: { status: Status }) {
  const cfg = STATUS_CONFIG[status] ?? FALLBACK;
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      <span className={`text-xs font-mono ${cfg.text}`}>{cfg.label}</span>
    </div>
  );
}
