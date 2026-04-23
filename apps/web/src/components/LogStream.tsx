import { useEffect, useRef, useState } from 'react';
import { useLogStream, type LogLine } from '../hooks/useLogStream';

type Phase = 'all' | 'build' | 'deploy' | 'system';

const PHASES: Phase[] = ['all', 'build', 'deploy', 'system'];

function lineColor(entry: LogLine): string {
  if (entry.stream === 'stderr') return 'text-red-400';
  if (entry.phase === 'system') return 'text-gray-500';
  return 'text-gray-300';
}

interface Props {
  deploymentId: string;
}

export function LogStream({ deploymentId }: Props) {
  const lines = useLogStream(deploymentId);
  const [phase, setPhase] = useState<Phase>('all');
  const bottomRef = useRef<HTMLDivElement>(null);

  const visible =
    phase === 'all' ? lines : lines.filter((l) => l.phase === phase || l.phase === 'health_check' && phase === 'deploy');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visible.length]);

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {PHASES.map((p) => (
          <button
            key={p}
            onClick={() => setPhase(p)}
            className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
              phase === p
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="h-64 overflow-y-auto rounded-lg border border-gray-800 bg-gray-950 p-3 font-mono text-xs">
        {visible.length === 0 ? (
          <span className="text-gray-600">Waiting for logs…</span>
        ) : (
          visible.map((entry, i) => (
            <div key={i} className={`whitespace-pre-wrap break-all leading-5 ${lineColor(entry)}`}>
              {entry.line}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
