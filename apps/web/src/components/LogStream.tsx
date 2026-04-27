import { useEffect, useRef, useState } from 'react';
import { useLogStream, type LogLine } from '../hooks/useLogStream';
import { ScrollArea } from '@/components/ui/scroll-area';

type Phase = 'all' | 'build' | 'deploy' | 'system';
const PHASES: Phase[] = ['all', 'build', 'deploy', 'system'];

const PHASE_LABEL: Record<string, string> = {
  build: 'bld',
  deploy: 'run',
  health_check: 'hc',
  routing: 'rt',
  system: 'sys',
};

function lineColor(entry: LogLine): string {
  if (entry.stream === 'stderr') return 'text-red-400';
  if (entry.phase === 'system') return 'text-zinc-500';
  return 'text-zinc-300';
}

function phaseColor(phase: string): string {
  switch (phase) {
    case 'build': return 'text-amber-500';
    case 'deploy': return 'text-blue-500';
    case 'health_check': return 'text-purple-400';
    case 'routing': return 'text-blue-400';
    default: return 'text-zinc-600';
  }
}

export function LogStream({ deploymentId }: { deploymentId: string }) {
  const lines = useLogStream(deploymentId);
  const [phase, setPhase] = useState<Phase>('all');
  const bottomRef = useRef<HTMLDivElement>(null);

  const visible =
    phase === 'all'
      ? lines
      : lines.filter(
          (l) => l.phase === phase || (l.phase === 'health_check' && phase === 'deploy'),
        );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visible.length]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        {PHASES.map((p) => (
          <button
            key={p}
            onClick={() => setPhase(p)}
            className={`rounded px-2 py-0.5 text-xs font-mono font-medium transition-colors ${
              phase === p ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {p}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-zinc-600 font-mono tabular-nums">
          {visible.length} lines
        </span>
      </div>

      <ScrollArea className="h-56 rounded-md border border-zinc-800">
        <div className="bg-zinc-950 p-3 font-mono text-xs min-h-full">
          {visible.length === 0 ? (
            <span className="text-zinc-600">Waiting for logs…</span>
          ) : (
            visible.map((entry, i) => (
              <div key={i} className="flex gap-2.5 leading-5">
                <span className={`shrink-0 w-7 tabular-nums ${phaseColor(entry.phase)}`}>
                  {PHASE_LABEL[entry.phase] ?? 'sys'}
                </span>
                <span className={`whitespace-pre-wrap break-all ${lineColor(entry)}`}>
                  {entry.line}
                </span>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  );
}
