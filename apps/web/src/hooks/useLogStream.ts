import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

export function useLogStream(deploymentId: string | null): string[] {
  const [lines, setLines] = useState<string[]>([]);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!deploymentId) return;

    setLines([]);

    const es = new EventSource(api.logs.streamUrl(deploymentId));
    esRef.current = es;

    es.onmessage = (e: MessageEvent<string>) => {
      setLines((prev) => [...prev, e.data]);
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
