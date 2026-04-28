import { Injectable } from '@nestjs/common';

interface CaddyRoute {
  '@id'?: string;
  match: { host: string[] }[];
  handle: { handler: string; upstreams: { dial: string }[] }[];
}

@Injectable()
export class CaddyService {
  private readonly adminUrl = process.env.CADDY_ADMIN_URL ?? 'http://localhost:2019';

  private get headers() {
    return {
      'Content-Type': 'application/json',
      Origin: this.adminUrl,
    };
  }

  routeId(deploymentId: string): string {
    return `brimble-${deploymentId}`;
  }

  async addRoute(deploymentId: string, slug: string, port: number): Promise<string> {
    const id = this.routeId(deploymentId);
    const route = {
      '@id': id,
      match: [{ host: [`${slug}.localhost`] }],
      handle: [
        {
          handler: 'reverse_proxy',
          upstreams: [{ dial: `host.docker.internal:${port}` }],
        },
      ],
    };

    // Caddy's /id/{id} endpoint lets us update a named route atomically without knowing its position.
    const putRes = await fetch(`${this.adminUrl}/id/${id}`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(route),
    });
    if (putRes.ok) return id;

    const serverKey = await this.discoverServerKey();
    const routesPath = `${this.adminUrl}/config/apps/http/servers/${serverKey}/routes`;

    const routesRes = await fetch(routesPath, { headers: this.headers });
    if (routesRes.ok) {
      // Prepend so our host-matched route wins before the catch-all static response.
      // Caddy evaluates routes top-to-bottom; PUT would replace index 0, PATCH replaces the whole array.
      const currentRoutes = (await routesRes.json().catch(() => [])) as CaddyRoute[];
      const newRoutes = [route, ...currentRoutes.filter((r) => r['@id'] !== id)];
      const replaceRes = await fetch(routesPath, {
        method: 'PATCH',
        headers: this.headers,
        body: JSON.stringify(newRoutes),
      });
      if (!replaceRes.ok) {
        const text = await replaceRes.text();
        throw new Error(`Caddy admin error ${replaceRes.status}: ${text}`);
      }
    } else {
      // No routes array yet (fresh Caddy); PUT creates it.
      const createRes = await fetch(routesPath, {
        method: 'PUT',
        headers: this.headers,
        body: JSON.stringify([route]),
      });
      if (!createRes.ok) {
        const text = await createRes.text();
        throw new Error(`Caddy admin error ${createRes.status}: ${text}`);
      }
    }

    return id;
  }

  async removeRoute(deploymentId: string): Promise<void> {
    await fetch(`${this.adminUrl}/id/${this.routeId(deploymentId)}`, {
      method: 'DELETE',
      headers: this.headers,
    }).catch(() => {});
  }

  private async discoverServerKey(): Promise<string> {
    const res = await fetch(`${this.adminUrl}/config/apps/http/servers`, {
      headers: this.headers,
    });
    if (!res.ok) return 'srv0';
    const servers = await res.json().catch(() => ({})) as Record<string, { listen?: string[] }>;
    const port = process.env.CADDY_PUBLIC_PORT ?? '7402';
    for (const [key, srv] of Object.entries(servers)) {
      if (srv.listen?.some((addr) => addr.includes(port))) return key;
    }
    return Object.keys(servers)[0] ?? 'srv0';
  }
}
