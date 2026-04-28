import { Injectable } from '@nestjs/common';
import * as Dockerode from 'dockerode';
import { Subject, Observable } from 'rxjs';

export interface ContainerMetrics {
  deploymentId: string;
  containerId: string;
  cpuPercent: number;
  memoryUsageMB: number;
  memoryLimitMB: number;
  memoryPercent: number;
  uptimeSeconds: number;
  ts: Date;
}

interface DockerStats {
  read: string;
  cpu_stats: {
    cpu_usage: { total_usage: number; percpu_usage?: number[] };
    system_cpu_usage: number;
    online_cpus?: number;
  };
  precpu_stats: {
    cpu_usage: { total_usage: number };
    system_cpu_usage: number;
  };
  memory_stats: { usage: number; limit: number };
}

interface DestroyableStream extends NodeJS.ReadableStream {
  destroy?(): void;
}

@Injectable()
export class MetricsService {
  private readonly docker = new Dockerode({
    socketPath: process.env.DOCKER_SOCKET ?? '/var/run/docker.sock',
  });

  private readonly subjects = new Map<string, Subject<ContainerMetrics>>();
  private readonly rawStreams = new Map<string, DestroyableStream>();

  startMetrics(deploymentId: string, containerId: string): void {
    this.stopMetrics(deploymentId);

    const subject = new Subject<ContainerMetrics>();
    this.subjects.set(deploymentId, subject);

    const container = this.docker.getContainer(containerId);
    const startedAt = Date.now();

    container.stats({ stream: true }, (err, stream) => {
      if (err || !stream) {
        subject.complete();
        return;
      }
      this.rawStreams.set(deploymentId, stream);

      stream.on('data', (chunk: Buffer) => {
        try {
          const s = JSON.parse(chunk.toString()) as DockerStats;
          const cpuDelta =
            s.cpu_stats.cpu_usage.total_usage - s.precpu_stats.cpu_usage.total_usage;
          const sysDelta =
            s.cpu_stats.system_cpu_usage - s.precpu_stats.system_cpu_usage;
          const numCpus =
            s.cpu_stats.online_cpus ?? s.cpu_stats.cpu_usage.percpu_usage?.length ?? 1;
          const cpuPercent =
            sysDelta > 0 ? (cpuDelta / sysDelta) * numCpus * 100 : 0;

          const memUsage = s.memory_stats.usage / 1024 / 1024;
          const memLimit = s.memory_stats.limit / 1024 / 1024;

          subject.next({
            deploymentId,
            containerId,
            cpuPercent: Math.round(cpuPercent * 10) / 10,
            memoryUsageMB: Math.round(memUsage * 10) / 10,
            memoryLimitMB: Math.round(memLimit),
            memoryPercent: Math.round((s.memory_stats.usage / s.memory_stats.limit) * 1000) / 10,
            uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
            ts: new Date(s.read),
          });
        } catch {
          // ignore unparseable stat frames
        }
      });

      stream.on('end', () => subject.complete());
      stream.on('error', () => subject.complete());
    });
  }

  isTracking(deploymentId: string): boolean {
    return this.subjects.has(deploymentId);
  }

  stopMetrics(deploymentId: string): void {
    const stream = this.rawStreams.get(deploymentId);
    if (stream) {
      stream.destroy?.();
      this.rawStreams.delete(deploymentId);
    }
    const subject = this.subjects.get(deploymentId);
    if (subject) {
      subject.complete();
      this.subjects.delete(deploymentId);
    }
  }

  getMetricsStream(deploymentId: string): Observable<ContainerMetrics> {
    return (this.subjects.get(deploymentId) ?? new Subject<ContainerMetrics>()).asObservable();
  }
}
