import { Injectable } from '@nestjs/common';
import { spawn } from 'child_process';
import { PrismaService } from '../database/prisma.service';
import { LogsService } from '../logs/logs.service';
import { DockerService } from './docker.service';
import { CaddyService } from './caddy.service';

@Injectable()
export class PipelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logsService: LogsService,
    private readonly docker: DockerService,
    private readonly caddy: CaddyService,
  ) {}

  async run(deploymentId: string, source: string, sourceType: string): Promise<void> {
    const log = (line: string, stream: 'stdout' | 'stderr' = 'stdout') =>
      this.logsService.emit(deploymentId, line, stream);

    try {
      await this.setStatus(deploymentId, 'building');

      const imageTag = `brimble/${deploymentId}:latest`;
      await log(`[pipeline] Building image ${imageTag}`);

      await this.runRailpack(source, sourceType, imageTag, log);

      await this.setStatus(deploymentId, 'deploying', { imageTag });
      await log('[pipeline] Starting container');

      const { containerId, port } = await this.docker.runContainer(imageTag, deploymentId);
      await this.caddy.addRoute(deploymentId, port);

      const url = `http://${deploymentId}.localhost`;
      await this.setStatus(deploymentId, 'running', { containerId, port, url });
      await log(`[pipeline] Deployment live at ${url}`);
    } catch (err) {
      await log(`[pipeline] ERROR: ${err.message}`, 'stderr');
      await this.setStatus(deploymentId, 'failed').catch(() => {});
    } finally {
      this.logsService.close(deploymentId);
    }
  }

  async stop(deploymentId: string, containerId: string | null): Promise<void> {
    if (containerId) await this.docker.stopContainer(containerId);
    await this.caddy.removeRoute(deploymentId).catch(() => {});
  }

  private setStatus(
    id: string,
    status: string,
    extra?: Partial<{ imageTag: string; containerId: string; port: number; url: string }>,
  ) {
    return this.prisma.deployment.update({ where: { id }, data: { status, ...extra } });
  }

  private runRailpack(
    source: string,
    sourceType: string,
    imageTag: string,
    log: (line: string, stream?: 'stdout' | 'stderr') => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args =
        sourceType === 'git'
          ? ['build', '--git', source, '--tag', imageTag]
          : ['build', source, '--tag', imageTag];

      const child = spawn('railpack', args, { shell: false });

      child.stdout.on('data', (chunk: Buffer) =>
        chunk
          .toString()
          .split('\n')
          .filter(Boolean)
          .forEach((l) => log(l, 'stdout')),
      );

      child.stderr.on('data', (chunk: Buffer) =>
        chunk
          .toString()
          .split('\n')
          .filter(Boolean)
          .forEach((l) => log(l, 'stderr')),
      );

      child.on('close', (code) =>
        code === 0 ? resolve() : reject(new Error(`railpack exited with code ${code}`)),
      );

      child.on('error', reject);
    });
  }
}
