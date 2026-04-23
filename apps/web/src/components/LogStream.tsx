import { useEffect, useRef } from 'react';
import { useLogStream } from '../hooks/useLogStream';

interface Props {
  deploymentId: string;
}

export function LogStream({ deploymentId }: Props) {
  const lines = useLogStream(deploymentId);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  return (
    <div className="h-64 overflow-y-auto rounded-lg border border-gray-800 bg-gray-950 p-3 font-mono text-xs text-gray-300">
      {lines.length === 0 ? (
        <span className="text-gray-600">Waiting for logs…</span>
      ) : (
        lines.map((line, i) => (
          <div key={i} className="whitespace-pre-wrap break-all leading-5">
            {line}
          </div>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
}
