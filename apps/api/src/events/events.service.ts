import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async createEvent(
    deploymentId: string,
    type: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.deploymentEvent
      .create({ data: { deploymentId, type, message, metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined } })
      .catch(() => undefined); // never block the pipeline
  }

  getEvents(deploymentId: string) {
    return this.prisma.deploymentEvent.findMany({
      where: { deploymentId },
      orderBy: { ts: 'asc' },
    });
  }
}
