const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3001';

export interface Deployment {
  id: string;
  name: string;
  source: string;
  sourceType: 'git' | 'upload';
  status: 'pending' | 'building' | 'deploying' | 'running' | 'failed';
  imageTag: string | null;
  containerId: string | null;
  url: string | null;
  port: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDeploymentPayload {
  name: string;
  source: string;
  sourceType: 'git' | 'upload';
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
  },
  logs: {
    streamUrl: (id: string) => `${BASE_URL}/deployments/${id}/logs`,
  },
};
