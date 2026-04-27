const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3001';

export interface LatestBuild {
  id: string;
  imageTag: string;
  durationMs: number | null;
  cacheHit: boolean;
  createdAt: string;
}

export interface Deployment {
  id: string;
  name: string;
  slug: string | null;
  source: string;
  sourceType: 'git' | 'upload';
  status:
    | 'pending'
    | 'building'
    | 'deploying'
    | 'health_check'
    | 'routing'
    | 'running'
    | 'failed'
    | 'stopped';
  imageTag: string | null;
  containerId: string | null;
  url: string | null;
  port: number | null;
  createdAt: string;
  updatedAt: string;
  builds: LatestBuild[];
}

export interface CreateDeploymentPayload {
  name: string;
  source: string;
  sourceType: 'git' | 'upload';
  envVars?: { key: string; value: string }[];
}

export interface Build {
  id: string;
  deploymentId: string;
  imageTag: string;
  durationMs: number | null;
  cacheHit: boolean;
  createdAt: string;
}

export interface DeploymentEvent {
  id: string;
  deploymentId: string;
  type: string;
  message: string;
  metadata: Record<string, unknown> | null;
  ts: string;
}

export interface EnvVarEntry {
  key: string;
  value: string; // always '***' from API
}

export interface EnvVarInput {
  key: string;
  value: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export const api = {
  deployments: {
    list: () => request<Deployment[]>('/deployments'),
    get: (id: string) => request<Deployment>(`/deployments/${id}`),
    create: (payload: CreateDeploymentPayload) =>
      request<Deployment>('/deployments', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    delete: (id: string) => request<void>(`/deployments/${id}`, { method: 'DELETE' }),
    redeploy: (id: string) =>
      request<{ queued: boolean }>(`/deployments/${id}/redeploy`, { method: 'POST' }),
    rollback: (id: string, imageTag: string) =>
      request<{ queued: boolean; imageTag: string }>(`/deployments/${id}/rollback`, {
        method: 'POST',
        body: JSON.stringify({ imageTag }),
      }),
    getBuilds: (id: string) => request<Build[]>(`/deployments/${id}/builds`),
    getEvents: (id: string) => request<DeploymentEvent[]>(`/deployments/${id}/events`),
  },
  envVars: {
    list: (id: string) => request<EnvVarEntry[]>(`/deployments/${id}/env`),
    update: (id: string, vars: EnvVarInput[]) =>
      request<{ updated: boolean }>(`/deployments/${id}/env`, {
        method: 'PATCH',
        body: JSON.stringify({ vars }),
      }),
  },
  logs: {
    streamUrl: (id: string) => `${BASE_URL}/deployments/${id}/logs`,
  },
  config: {
    getWebhookUrl: () =>
      request<{ webhookUrl: string; events: string[] }>('/config/webhook-url'),
  },
};
