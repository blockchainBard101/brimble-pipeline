import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PipelineService } from '../pipeline/pipeline.service';
import { QueueService } from '../queue/queue.service';
import { CreateDeploymentDto } from './dto/create-deployment.dto';

@Injectable()
export class DeploymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pipeline: PipelineService,
    private readonly queue: QueueService,
  ) {}

  async create(dto: CreateDeploymentDto) {
    const deployment = await this.prisma.deployment.create({
      data: {
        name: dto.name,
        source: dto.source,
        sourceType: dto.sourceType,
        status: 'pending',
      },
    });

    await this.queue.addDeploymentJob(deployment.id);
    return deployment;
  }

  findAll() {
    return this.prisma.deployment.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        status: true,
        imageTag: true,
        url: true,
        port: true,
        containerId: true,
        source: true,
        sourceType: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findOne(id: string) {
    const deployment = await this.prisma.deployment.findUnique({
      where: { id },
      include: { logs: { orderBy: { ts: 'asc' }, take: 500 } },
    });
    if (!deployment) throw new NotFoundException(`Deployment ${id} not found`);
    return deployment;
  }

  async remove(id: string) {
    const deployment = await this.findOne(id);
    await this.pipeline.stop(deployment.id, deployment.containerId);
    return this.prisma.deployment.update({
      where: { id },
      data: { status: 'stopped' },
    });
  }

  async rollback(id: string, imageTag: string) {
    const build = await this.prisma.build.findFirst({
      where: { deploymentId: id, imageTag },
    });
    if (!build) {
      throw new BadRequestException(`No build with tag ${imageTag} exists for deployment ${id}`);
    }
    this.pipeline.rollback(id, imageTag).catch((err) =>
      console.error(`Rollback error for ${id}:`, err),
    );
    return { queued: true, imageTag };
  }

  getBuilds(id: string) {
    return this.prisma.build.findMany({
      where: { deploymentId: id },
      orderBy: { createdAt: 'desc' },
    });
  }
}
