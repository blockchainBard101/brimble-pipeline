import { Injectable } from '@nestjs/common';

@Injectable()
export class CaddyService {
  private readonly adminUrl = process.env.CADDY_ADMIN_URL ?? 'http://localhost:2019';

  async addRoute(deploymentId: string, port: number): Promise<void> {
    const route = {
      '@id': `brimble-${deploymentId}`,
      match: [{ host: [`${deploymentId}.localhost`] }],
      handle: [
        {
          handler: 'reverse_proxy',
          upstreams: [{ dial: `host.docker.internal:${port}` }],
        },
      ],
    };

    const res = await fetch(
      `${this.adminUrl}/config/apps/http/servers/srv0/routes/...`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(route),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Caddy admin error ${res.status}: ${text}`);
    }
  }

  async removeRoute(deploymentId: string): Promise<void> {
    await fetch(`${this.adminUrl}/id/brimble-${deploymentId}`, {
      method: 'DELETE',
    });
  }
}
