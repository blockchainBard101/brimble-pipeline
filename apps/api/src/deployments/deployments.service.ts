import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PipelineService } from '../pipeline/pipeline.service';
import { CreateDeploymentDto } from './dto/create-deployment.dto';

@Injectable()
export class DeploymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pipeline: PipelineService,
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

    this.pipeline
      .run(deployment.id, deployment.source, deployment.sourceType)
      .catch((err) => console.error(`Pipeline error for ${deployment.id}:`, err));

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
    await this.prisma.log.deleteMany({ where: { deploymentId: id } });
    return this.prisma.deployment.delete({ where: { id } });
  }
}
