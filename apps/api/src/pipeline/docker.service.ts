import { Injectable } from '@nestjs/common';
import * as Dockerode from 'dockerode';
import { PortsService } from '../ports/ports.service';
import { LogsService } from '../logs/logs.service';
import { EnvVarsService } from '../deployments/env-vars.service';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

@Injectable()
export class DockerService {
  private readonly docker = new Dockerode({
    socketPath: process.env.DOCKER_SOCKET ?? '/var/run/docker.sock',
  });

  constructor(
    private readonly ports: PortsService,
    private readonly logsService: LogsService,
    private readonly envVarsService: EnvVarsService,
  ) {}

  // portKey is used for PortAllocation (normally = deploymentId; for rollback = deploymentId_rb).
  // logId is always the real deploymentId so logs appear in the right SSE stream.
  async runContainer(
    imageTag: string,
    portKey: string,
    logId: string,
  ): Promise<{ containerId: string; port: number }> {
    const port = await this.ports.acquirePort(portKey);

    const decryptedVars = await this.envVarsService.getDecrypted(logId);
    const envKeys = Object.keys(decryptedVars);
    if (envKeys.length) {
      await this.logsService.append(
        logId,
        `[docker] Injecting env vars: ${envKeys.join(', ')}`,
        'stdout',
        'deploy',
      );
    }

    await this.logsService.append(
      logId,
      `[docker] Starting container from ${imageTag} on host port ${port}`,
      'stdout',
      'deploy',
    );

    const envArray = [
      `PORT=${port}`,
      ...Object.entries(decryptedVars).map(([k, v]) => `${k}=${v}`),
    ];

    const container = await this.docker.createContainer({
      Image: imageTag,
      name: `brimble-${portKey}`,
      Env: envArray,
      ExposedPorts: { [`${port}/tcp`]: {} },
      HostConfig: {
        Memory: 512 * 1024 * 1024,
        MemorySwap: 512 * 1024 * 1024,
        NanoCpus: 500_000_000,
        PortBindings: { [`${port}/tcp`]: [{ HostPort: String(port) }] },
        RestartPolicy: { Name: 'no' },
      },
    });

    await container.start();
    await this.logsService.append(logId, `[docker] Container ${container.id.slice(0, 12)} started`, 'stdout', 'deploy');

    return { containerId: container.id, port };
  }

  async stopContainer(containerId: string, portKey: string, logId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);

      await this.logsService.append(logId, `[docker] Sending SIGTERM to ${containerId.slice(0, 12)}`, 'stdout', 'system');
      await container.kill({ signal: 'SIGTERM' }).catch(() => {});

      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline) {
        const info = await container.inspect().catch(() => null);
        if (!info || !info.State.Running) break;
        await sleep(500);
      }

      const info = await container.inspect().catch(() => null);
      if (info?.State.Running) {
        await this.logsService.append(logId, `[docker] Timeout — sending SIGKILL`, 'stderr', 'system');
        await container.kill({ signal: 'SIGKILL' }).catch(() => {});
      }

      await container.remove({ force: true }).catch(() => {});
      await this.logsService.append(logId, `[docker] Container removed`, 'stdout', 'system');
    } catch {
      // container already gone
    }

    await this.ports.releasePort(portKey);
  }
}
