import { Injectable } from '@nestjs/common';
import { spawn } from 'child_process';
import { PrismaService } from '../database/prisma.service';
import { LogsService } from '../logs/logs.service';
import { DockerService } from './docker.service';
import { CaddyService } from './caddy.service';
import { HealthService } from './health.service';
import { PortsService } from '../ports/ports.service';

@Injectable()
export class PipelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logsService: LogsService,
    private readonly docker: DockerService,
    private readonly caddy: CaddyService,
    private readonly health: HealthService,
    private readonly ports: PortsService,
  ) {}

  // Status flow: pending → building → deploying → health_check → routing → running | failed
  async run(deploymentId: string): Promise<void> {
    const deployment = await this.prisma.deployment.findUniqueOrThrow({
      where: { id: deploymentId },
    });
    const { source, sourceType } = deployment;

    const log = (line: string, stream: 'stdout' | 'stderr' = 'stdout', phase = 'system') =>
      this.logsService.append(deploymentId, line, stream, phase);

    try {
      await this.setStatus(deploymentId, 'building');
      const imageTag = `brimble/${deploymentId}:latest`;
      await log(`[pipeline] Building image ${imageTag}`, 'stdout', 'system');

      await this.runRailpack(source, sourceType, imageTag, deploymentId);

      await this.prisma.build.create({ data: { deploymentId, imageTag } });

      await this.setStatus(deploymentId, 'deploying', { imageTag });
      await log('[pipeline] Starting container', 'stdout', 'system');

      const { containerId, port } = await this.docker.runContainer(imageTag, deploymentId, deploymentId);

      await this.setStatus(deploymentId, 'health_check', { containerId, port });
      const healthy = await this.health.waitForHealthy(deploymentId, 'localhost', port);
      if (!healthy) throw new Error('Container failed health checks');

      await this.setStatus(deploymentId, 'routing');
      await log('[pipeline] Registering Caddy route', 'stdout', 'routing');

      const routeId = await this.caddy.addRoute(deploymentId, port);
      const url = `http://${deploymentId}.localhost`;

      await this.setStatus(deploymentId, 'running', { url, routeId });
      await log(`[pipeline] Deployment live at ${url}`, 'stdout', 'system');
    } catch (err) {
      await log(`[pipeline] FAILED: ${(err as Error).message}`, 'stderr', 'system');
      await this.setStatus(deploymentId, 'failed').catch(() => {});
    } finally {
      this.logsService.close(deploymentId);
    }
  }

  async rollback(deploymentId: string, imageTag: string): Promise<void> {
    const deployment = await this.prisma.deployment.findUniqueOrThrow({
      where: { id: deploymentId },
    });
    const oldContainerId = deployment.containerId;
    const oldPortKey = deploymentId;

    const log = (line: string, stream: 'stdout' | 'stderr' = 'stdout', phase = 'system') =>
      this.logsService.append(deploymentId, line, stream, phase);

    this.logsService.close(deploymentId);
    this.logsService['streams'].delete(deploymentId);

    try {
      await log(`[rollback] Rolling back to ${imageTag}`, 'stdout', 'system');
      await this.setStatus(deploymentId, 'deploying', { imageTag });

      const rbKey = `${deploymentId}_rb`;
      const { containerId: newContainerId, port: newPort } = await this.docker.runContainer(
        imageTag,
        rbKey,
        deploymentId,
      );

      await this.setStatus(deploymentId, 'health_check', { containerId: newContainerId, port: newPort });
      const healthy = await this.health.waitForHealthy(deploymentId, 'localhost', newPort);
      if (!healthy) {
        await this.docker.stopContainer(newContainerId, rbKey, deploymentId);
        throw new Error('Rollback container failed health checks');
      }

      await this.setStatus(deploymentId, 'routing');
      const routeId = await this.caddy.addRoute(`${deploymentId}-new`, newPort);
      await log('[rollback] New route healthy — swapping', 'stdout', 'routing');

      if (oldContainerId) {
        await this.docker.stopContainer(oldContainerId, oldPortKey, deploymentId);
      }
      await this.caddy.removeRoute(deploymentId);
      await this.ports.transferPort(rbKey, deploymentId);

      const url = `http://${deploymentId}.localhost`;
      await this.caddy.removeRoute(`${deploymentId}-new`);
      const finalRouteId = await this.caddy.addRoute(deploymentId, newPort);

      await this.prisma.build.create({ data: { deploymentId, imageTag } });
      await this.setStatus(deploymentId, 'running', {
        containerId: newContainerId,
        port: newPort,
        url,
        routeId: finalRouteId,
      });
      await log(`[rollback] Live at ${url}`, 'stdout', 'system');
    } catch (err) {
      await log(`[rollback] FAILED: ${(err as Error).message}`, 'stderr', 'system');
      await this.setStatus(deploymentId, 'failed').catch(() => {});
    } finally {
      this.logsService.close(deploymentId);
    }
  }

  async stop(deploymentId: string, containerId: string | null): Promise<void> {
    if (containerId) {
      await this.docker.stopContainer(containerId, deploymentId, deploymentId);
    }
    await this.caddy.removeRoute(deploymentId);
  }

  private setStatus(
    id: string,
    status: string,
    extra?: Partial<{
      imageTag: string;
      containerId: string;
      port: number;
      url: string;
      routeId: string;
    }>,
  ) {
    return this.prisma.deployment.update({ where: { id }, data: { status, ...extra } });
  }

  private runRailpack(
    source: string,
    sourceType: string,
    imageTag: string,
    deploymentId: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args =
        sourceType === 'git'
          ? ['build', '--git', source, '--tag', imageTag]
          : ['build', source, '--tag', imageTag];

      const child = spawn('railpack', args, { shell: false });

      const log = (chunk: Buffer, stream: 'stdout' | 'stderr') =>
        chunk
          .toString()
          .split('\n')
          .filter(Boolean)
          .forEach((l) => this.logsService.append(deploymentId, l, stream, 'build'));

      child.stdout.on('data', (c: Buffer) => log(c, 'stdout'));
      child.stderr.on('data', (c: Buffer) => log(c, 'stderr'));
      child.on('close', (code) =>
        code === 0 ? resolve() : reject(new Error(`railpack exited with code ${code}`)),
      );
      child.on('error', reject);
    });
  }
}
