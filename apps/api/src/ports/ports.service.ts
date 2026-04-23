import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

const PORT_MIN = 10_000;
const PORT_MAX = 20_000;

@Injectable()
export class PortsService {
  constructor(private readonly prisma: PrismaService) {}

  async acquirePort(deploymentId: string): Promise<number> {
    const taken = await this.prisma.portAllocation.findMany({ select: { port: true } });
    const takenSet = new Set(taken.map((p) => p.port));

    for (let port = PORT_MIN; port <= PORT_MAX; port++) {
      if (takenSet.has(port)) continue;
      try {
        await this.prisma.portAllocation.create({ data: { port, deploymentId } });
        return port;
      } catch {
        // Unique constraint race — another process grabbed it, try next.
      }
    }

    throw new Error(`No free ports available in range ${PORT_MIN}–${PORT_MAX}`);
  }

  async releasePort(deploymentId: string): Promise<void> {
    await this.prisma.portAllocation
      .delete({ where: { deploymentId } })
      .catch(() => {});
  }

  async transferPort(fromKey: string, toKey: string): Promise<void> {
    await this.prisma.portAllocation.update({
      where: { deploymentId: fromKey },
      data: { deploymentId: toKey },
    });
  }
}
