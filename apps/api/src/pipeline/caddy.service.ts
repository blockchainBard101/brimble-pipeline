import { Injectable } from '@nestjs/common';

@Injectable()
export class CaddyService {
  private readonly adminUrl = process.env.CADDY_ADMIN_URL ?? 'http://localhost:2019';

  routeId(deploymentId: string): string {
    return `brimble-${deploymentId}`;
  }

  async addRoute(deploymentId: string, port: number): Promise<string> {
    const id = this.routeId(deploymentId);
    const route = {
      '@id': id,
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

    return id;
  }

  async removeRoute(deploymentId: string): Promise<void> {
    await fetch(`${this.adminUrl}/id/${this.routeId(deploymentId)}`, {
      method: 'DELETE',
    }).catch(() => {});
  }
}
