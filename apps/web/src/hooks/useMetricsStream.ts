import { useState, useEffect, useRef } from 'react';

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3001';

export interface ContainerMetrics {
  deploymentId: string;
  containerId: string;
  cpuPercent: number;
  memoryUsageMB: number;
  memoryLimitMB: number;
  memoryPercent: number;
  uptimeSeconds: number;
  ts: string;
}

export function useMetricsStream(deploymentId: string | null): {
  metrics: ContainerMetrics | null;
  connected: boolean;
} {
  const [metrics, setMetrics] = useState<ContainerMetrics | null>(null);
  const [connected, setConnected] = useState(false);
  const retryDelay = useRef(1000);
  const esRef = useRef<EventSource | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!deploymentId) return;
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      const es = new EventSource(`${BASE_URL}/deployments/${deploymentId}/metrics`);
      esRef.current = es;

      es.onopen = () => {
        setConnected(true);
        retryDelay.current = 1000;
      };

      es.onmessage = (e: MessageEvent<string>) => {
        try {
          setMetrics(JSON.parse(e.data) as ContainerMetrics);
        } catch {
          // ignore
        }
      };

      es.onerror = () => {
        setConnected(false);
        es.close();
        if (!cancelled) {
          timerRef.current = setTimeout(() => {
            retryDelay.current = Math.min(retryDelay.current * 2, 30_000);
            connect();
          }, retryDelay.current);
        }
      };
    }

    connect();

    return () => {
      cancelled = true;
      esRef.current?.close();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [deploymentId]);

  return { metrics, connected };
}
