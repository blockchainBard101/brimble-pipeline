import { Injectable } from '@nestjs/common';
import * as http from 'http';
import { LogsService } from '../logs/logs.service';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface HealthResult {
  healthy: boolean;
  attempts: number;
}

@Injectable()
export class HealthService {
  constructor(private readonly logsService: LogsService) {}

  async waitForHealthy(
    deploymentId: string,
    host: string,
    port: number,
    opts?: { retries?: number; intervalMs?: number },
  ): Promise<HealthResult> {
    const retries = opts?.retries ?? 10;
    const intervalMs = opts?.intervalMs ?? 2000;

    for (let attempt = 1; attempt <= retries; attempt++) {
      await this.logsService.append(
        deploymentId,
        `[health] Attempt ${attempt}/${retries}: GET http://${host}:${port}/`,
        'stdout',
        'health_check',
      );

      const ok = await this.probe(host, port);

      if (ok) {
        await this.logsService.append(
          deploymentId,
          `[health] Container healthy after ${attempt} attempt(s)`,
          'stdout',
          'health_check',
        );
        return { healthy: true, attempts: attempt };
      }

      if (attempt < retries) await sleep(intervalMs);
    }

    await this.logsService.append(
      deploymentId,
      `[health] Container did not become healthy after ${retries} attempts`,
      'stderr',
      'health_check',
    );
    return { healthy: false, attempts: retries };
  }

  private probe(host: string, port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get({ host, port, path: '/', timeout: 3_000 }, (res) => {
        resolve((res.statusCode ?? 500) < 500);
        res.resume();
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });
  }
}
