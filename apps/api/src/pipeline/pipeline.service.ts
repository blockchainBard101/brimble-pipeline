import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PrismaService } from '../database/prisma.service';
import { LogsService } from '../logs/logs.service';
import { DockerService } from './docker.service';
import { CaddyService } from './caddy.service';
import { HealthService } from './health.service';
import { PortsService } from '../ports/ports.service';
import { MetricsService } from '../metrics/metrics.service';
import { EventsService } from '../events/events.service';
import { DeploymentStatus } from '../common/deployment-status.type';

function appUrl(host: string): string {
  const port = process.env.CADDY_PUBLIC_PORT;
  return `http://${host}.localhost${port ? `:${port}` : ''}`;
}

function fmtDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

@Injectable()
export class PipelineService implements OnModuleInit {
  private readonly logger = new Logger(PipelineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly logsService: LogsService,
    private readonly docker: DockerService,
    private readonly caddy: CaddyService,
    private readonly health: HealthService,
    private readonly ports: PortsService,
    private readonly metrics: MetricsService,
    private readonly events: EventsService,
  ) {}

  async onModuleInit() {
    const running = await this.prisma.deployment.findMany({
      where: { status: 'running' },
      select: { id: true, slug: true, port: true },
    });
    for (const d of running) {
      if (!d.port) continue;
      const host = d.slug ?? d.id;
      try {
        await this.caddy.addRoute(d.id, host, d.port);
        this.logger.log(`Restored Caddy route for ${host}`);
      } catch (err) {
        this.logger.warn(`Failed to restore route for ${host}: ${(err as Error).message}`);
      }
    }
  }

  async run(deploymentId: string): Promise<void> {
    const deployment = await this.prisma.deployment.findUniqueOrThrow({
      where: { id: deploymentId },
    });
    const { source, sourceType, slug, name } = deployment;
    const host = slug ?? deploymentId;

    try {
      await this.logsService.clear(deploymentId);
      await this.setStatus(deploymentId, 'building');
      await this.events.createEvent(deploymentId, 'status_change', 'Status changed to building');

      const imageTag = `brimble/${deploymentId}:${Date.now()}`;
      await this.log(deploymentId, `[pipeline] Building image ${imageTag}`, 'stdout', 'system');
      await this.log(deploymentId, `[pipeline] Checking build cache for ${name}...`, 'stdout', 'build');

      const { durationMs, cacheHit } = await this.runRailpack(
        source,
        sourceType,
        imageTag,
        deploymentId,
      );
      const durationStr = fmtDuration(durationMs);
      await this.log(
        deploymentId,
        `[pipeline] Build completed in ${durationStr} (cache: ${cacheHit ? 'hit' : 'miss'})`,
        'stdout',
        'build',
      );

      await this.prisma.build.create({ data: { deploymentId, imageTag, durationMs, cacheHit } });
      await this.events.createEvent(
        deploymentId,
        'build_complete',
        `Image ${imageTag} built in ${durationStr}`,
        { imageTag, durationMs, cacheHit },
      );

      await this.setStatus(deploymentId, 'deploying', { imageTag });
      await this.events.createEvent(deploymentId, 'status_change', 'Status changed to deploying');
      await this.log(deploymentId, '[pipeline] Starting container', 'stdout', 'system');

      const { containerId, port } = await this.docker.runContainer(
        imageTag,
        deploymentId,
        deploymentId,
      );

      await this.setStatus(deploymentId, 'health_check', { containerId, port });
      await this.events.createEvent(deploymentId, 'status_change', 'Status changed to health_check');

      const { healthy, attempts } = await this.health.waitForHealthy(
        deploymentId,
        'host.docker.internal',
        port,
      );
      if (!healthy) throw new Error('Container failed health checks');
      await this.events.createEvent(
        deploymentId,
        'health_check',
        `Container healthy after ${attempts} attempt(s)`,
        { attempts, port },
      );

      await this.setStatus(deploymentId, 'routing');
      await this.events.createEvent(deploymentId, 'status_change', 'Status changed to routing');
      await this.log(deploymentId, '[pipeline] Registering Caddy route', 'stdout', 'routing');

      const routeId = await this.caddy.addRoute(deploymentId, host, port);
      const url = appUrl(host);
      await this.events.createEvent(
        deploymentId,
        'route_added',
        `Route registered: ${host}.localhost`,
        { url },
      );

      await this.setStatus(deploymentId, 'running', { url, routeId });
      await this.events.createEvent(deploymentId, 'status_change', 'Status changed to running');
      await this.log(deploymentId, `[pipeline] Deployment live at ${url}`, 'stdout', 'system');

      this.metrics.startMetrics(deploymentId, containerId);
    } catch (err) {
      await this.log(deploymentId, `[pipeline] FAILED: ${(err as Error).message}`, 'stderr', 'system');
      await this.setStatus(deploymentId, 'failed').catch(() => {});
      throw err;
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
    const host = deployment.slug ?? deploymentId;

    this.logsService.resetStream(deploymentId);

    try {
      await this.log(deploymentId, `[rollback] Rolling back to ${imageTag}`, 'stdout', 'system');
      await this.setStatus(deploymentId, 'deploying', { imageTag });
      await this.events.createEvent(deploymentId, 'rollback', `Rolling back to ${imageTag}`, {
        imageTag,
      });

      const rbKey = `${deploymentId}_rb`;
      const { containerId: newContainerId, port: newPort } = await this.docker.runContainer(
        imageTag,
        rbKey,
        deploymentId,
      );

      await this.setStatus(deploymentId, 'health_check', {
        containerId: newContainerId,
        port: newPort,
      });
      const { healthy, attempts } = await this.health.waitForHealthy(
        deploymentId,
        'host.docker.internal',
        newPort,
      );
      if (!healthy) {
        await this.docker.stopContainer(newContainerId, rbKey, deploymentId);
        throw new Error('Rollback container failed health checks');
      }
      await this.events.createEvent(
        deploymentId,
        'health_check',
        `Container healthy after ${attempts} attempt(s)`,
        { attempts, port: newPort },
      );

      await this.setStatus(deploymentId, 'routing');
      const routeId = await this.caddy.addRoute(`${deploymentId}-rb`, `${host}-rb`, newPort);
      await this.log(deploymentId, '[rollback] New route healthy — swapping', 'stdout', 'routing');

      this.metrics.stopMetrics(deploymentId);
      if (oldContainerId) {
        await this.docker.stopContainer(oldContainerId, oldPortKey, deploymentId);
      }
      await this.caddy.removeRoute(deploymentId);
      await this.ports.transferPort(rbKey, deploymentId);

      const url = appUrl(host);
      await this.caddy.removeRoute(`${deploymentId}-rb`);
      const finalRouteId = await this.caddy.addRoute(deploymentId, host, newPort);

      await this.prisma.build.create({ data: { deploymentId, imageTag } });
      await this.setStatus(deploymentId, 'running', {
        containerId: newContainerId,
        port: newPort,
        url,
        routeId: finalRouteId,
      });
      await this.events.createEvent(
        deploymentId,
        'route_added',
        `Route registered: ${host}.localhost`,
        { url },
      );
      await this.events.createEvent(deploymentId, 'status_change', 'Status changed to running');
      await this.log(deploymentId, `[rollback] Live at ${url}`, 'stdout', 'system');

      this.metrics.startMetrics(deploymentId, newContainerId);
    } catch (err) {
      await this.log(deploymentId, `[rollback] FAILED: ${(err as Error).message}`, 'stderr', 'system');
      await this.setStatus(deploymentId, 'failed').catch(() => {});
    } finally {
      this.logsService.close(deploymentId);
    }
  }

  async stop(deploymentId: string, containerId: string | null): Promise<void> {
    this.metrics.stopMetrics(deploymentId);
    if (containerId) {
      await this.docker.stopContainer(containerId, deploymentId, deploymentId);
    } else {
      await this.ports.releasePort(deploymentId);
    }
    await this.caddy.removeRoute(deploymentId);
  }

  private log(
    deploymentId: string,
    line: string,
    stream: 'stdout' | 'stderr' = 'stdout',
    phase = 'system',
  ) {
    return this.logsService.append(deploymentId, line, stream, phase);
  }

  private setStatus(
    id: string,
    status: DeploymentStatus,
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

  private async runRailpack(
    source: string,
    sourceType: string,
    imageTag: string,
    deploymentId: string,
  ): Promise<{ durationMs: number; cacheHit: boolean }> {
    let buildDir = source;
    let tmpDir: string | null = null;

    if (sourceType === 'git') {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'brimble-'));
      await this.log(deploymentId, `[build] Cloning ${source}`, 'stdout', 'build');
      await this.spawnLogged('git', ['clone', '--depth=1', source, tmpDir], deploymentId, 'build');
      buildDir = tmpDir;
    }

    // If a previous build exists, BuildKit has the layers cached for this deployment.
    const previousBuild = await this.prisma.build.findFirst({ where: { deploymentId } });
    const cacheHit = !!previousBuild;

    const start = Date.now();
    try {
      await this.spawnLogged(
        'railpack',
        ['build', buildDir, '--name', imageTag, '--cache-key', deploymentId],
        deploymentId,
        'build',
      );
    } finally {
      if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }

    return { durationMs: Date.now() - start, cacheHit };
  }

  private spawnLogged(
    cmd: string,
    args: string[],
    deploymentId: string,
    phase: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, { shell: false });

      const pipe = (chunk: Buffer, stream: 'stdout' | 'stderr') =>
        chunk
          .toString()
          .split('\n')
          .filter(Boolean)
          .forEach((l) => this.logsService.append(deploymentId, l, stream, phase));

      child.stdout.on('data', (c: Buffer) => pipe(c, 'stdout'));
      child.stderr.on('data', (c: Buffer) => pipe(c, 'stderr'));
      child.on('close', (code) =>
        code === 0 ? resolve() : reject(new Error(`${cmd} exited with code ${code}`)),
      );
      child.on('error', reject);
    });
  }
}
