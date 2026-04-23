import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { PrismaService } from '../database/prisma.service';

interface LogEntry {
  subject: Subject<string>;
  closed: boolean;
}

@Injectable()
export class LogsService {
  private readonly streams = new Map<string, LogEntry>();

  constructor(private readonly prisma: PrismaService) {}

  private ensure(deploymentId: string): LogEntry {
    if (!this.streams.has(deploymentId)) {
      this.streams.set(deploymentId, {
        subject: new Subject<string>(),
        closed: false,
      });
    }
    return this.streams.get(deploymentId)!;
  }

  async emit(
    deploymentId: string,
    line: string,
    stream: 'stdout' | 'stderr' = 'stdout',
  ): Promise<void> {
    await this.prisma.log.create({ data: { deploymentId, line, stream } });
    const entry = this.ensure(deploymentId);
    if (!entry.closed) entry.subject.next(line);
  }

  close(deploymentId: string): void {
    const entry = this.streams.get(deploymentId);
    if (entry && !entry.closed) {
      entry.closed = true;
      entry.subject.complete();
    }
  }

  // Replays persisted logs first, then tails the live Subject.
  getStream(deploymentId: string): Observable<string> {
    return new Observable<string>((subscriber) => {
      let liveSub: { unsubscribe(): void } | null = null;

      this.prisma.log
        .findMany({ where: { deploymentId }, orderBy: { ts: 'asc' } })
        .then((logs) => {
          if (subscriber.closed) return;
          logs.forEach((l) => subscriber.next(l.line));

          const entry = this.ensure(deploymentId);
          if (entry.closed) {
            subscriber.complete();
            return;
          }

          liveSub = entry.subject.subscribe({
            next: (line) => subscriber.next(line),
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
