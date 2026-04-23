import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

export interface LogLine {
  line: string;
  stream: 'stdout' | 'stderr';
  phase: string;
}

export function useLogStream(deploymentId: string | null): LogLine[] {
  const [lines, setLines] = useState<LogLine[]>([]);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!deploymentId) return;

    setLines([]);

    const es = new EventSource(api.logs.streamUrl(deploymentId));
    esRef.current = es;

    es.onmessage = (e: MessageEvent<string>) => {
      try {
        const entry = JSON.parse(e.data) as LogLine;
        setLines((prev) => [...prev, entry]);
      } catch {
        setLines((prev) => [...prev, { line: e.data, stream: 'stdout', phase: 'system' }]);
      }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [deploymentId]);

  return lines;
}
