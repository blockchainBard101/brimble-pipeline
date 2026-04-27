import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

export interface LogLine {
  line: string;
  stream: 'stdout' | 'stderr';
  phase: string;
}

const TERMINAL = new Set(['running', 'failed', 'stopped']);

export function useLogStream(deploymentId: string | null, status?: string): LogLine[] {
  const [lines, setLines] = useState<LogLine[]>([]);
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    if (!deploymentId) return;

    setLines([]);

    let destroyed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let es: EventSource | null = null;

    function connect() {
      if (destroyed) return;

      es = new EventSource(api.logs.streamUrl(deploymentId!));

      es.onmessage = (e: MessageEvent<string>) => {
        try {
          setLines((prev) => [...prev, JSON.parse(e.data) as LogLine]);
        } catch {
          setLines((prev) => [...prev, { line: e.data, stream: 'stdout', phase: 'system' }]);
        }
      };

      es.onerror = () => {
        es?.close();
        es = null;
        if (destroyed) return;
        if (TERMINAL.has(statusRef.current ?? '')) return;
        // Pipeline still in progress — stream closed because clear() was called on redeploy/rollback.
        // Clear stale lines and reconnect to pick up the new run.
        setLines([]);
        retryTimer = setTimeout(connect, 1000);
      };
    }

    connect();

    return () => {
      destroyed = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  }, [deploymentId]);

  return lines;
}
