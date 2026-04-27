import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { PrismaService } from '../database/prisma.service';

export interface LogLine {
  line: string;
  stream: 'stdout' | 'stderr';
  phase: string;
}

interface LogEntry {
  subject: Subject<LogLine>;
  closed: boolean;
}

@Injectable()
export class LogsService {
  private readonly streams = new Map<string, LogEntry>();

  constructor(private readonly prisma: PrismaService) {}

  private ensure(deploymentId: string): LogEntry {
    if (!this.streams.has(deploymentId)) {
      this.streams.set(deploymentId, {
        subject: new Subject<LogLine>(),
        closed: false,
      });
    }
    return this.streams.get(deploymentId)!;
  }

  async append(
    deploymentId: string,
    line: string,
    stream: 'stdout' | 'stderr',
    phase: string,
  ): Promise<void> {
    await this.prisma.log.create({ data: { deploymentId, line, stream, phase } });
    const entry = this.ensure(deploymentId);
    if (!entry.closed) entry.subject.next({ line, stream, phase });
  }

  async clear(deploymentId: string): Promise<void> {
    await this.prisma.log.deleteMany({ where: { deploymentId } });
    const entry = this.streams.get(deploymentId);
    if (entry) {
      if (!entry.closed) entry.subject.complete();
      this.streams.delete(deploymentId);
    }
  }

  close(deploymentId: string): void {
    const entry = this.streams.get(deploymentId);
    if (entry && !entry.closed) {
      entry.closed = true;
      entry.subject.complete();
    }
  }

  // Replays persisted logs first, then tails the live Subject.
  getStream(deploymentId: string): Observable<LogLine> {
    return new Observable<LogLine>((subscriber) => {
      let liveSub: { unsubscribe(): void } | null = null;

      this.prisma.log
        .findMany({ where: { deploymentId }, orderBy: { ts: 'asc' } })
        .then((logs) => {
          if (subscriber.closed) return;
          logs.forEach((l) =>
            subscriber.next({ line: l.line, stream: l.stream as 'stdout' | 'stderr', phase: l.phase }),
          );

          const entry = this.ensure(deploymentId);
          if (entry.closed) {
            subscriber.complete();
            return;
          }

          liveSub = entry.subject.subscribe({
            next: (logLine) => subscriber.next(logLine),
            error: (err) => subscriber.error(err),
            complete: () => subscriber.complete(),
          });
        })
        .catch((err) => {
          if (!subscriber.closed) subscriber.error(err);
        });

      return () => liveSub?.unsubscribe();
    });
  }
}
