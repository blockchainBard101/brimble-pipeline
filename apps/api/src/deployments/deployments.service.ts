import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PipelineService } from '../pipeline/pipeline.service';
import { QueueService } from '../queue/queue.service';
import { EventsService } from '../events/events.service';
import { EnvVarsService } from './env-vars.service';
import { CreateDeploymentDto } from './dto/create-deployment.dto';

@Injectable()
export class DeploymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pipeline: PipelineService,
    private readonly queue: QueueService,
    private readonly events: EventsService,
    private readonly envVars: EnvVarsService,
  ) {}

  async create(dto: CreateDeploymentDto) {
    // Create first to get the generated ID, then derive slug from it.
    const deployment = await this.prisma.deployment.create({
      data: {
        name: dto.name,
        source: dto.source,
        sourceType: dto.sourceType,
        status: 'pending',
      },
    });

    const slug = `${this.slugify(dto.name)}-${deployment.id.slice(0, 8)}`;
    const updated = await this.prisma.deployment.update({
      where: { id: deployment.id },
      data: { slug },
    });

    if (dto.envVars?.length) {
      await this.envVars.setEnvVars(deployment.id, dto.envVars);
    }

    await this.queue.addDeploymentJob(deployment.id);
    return updated;
  }

  findAll() {
    return this.prisma.deployment.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        imageTag: true,
        url: true,
        port: true,
        containerId: true,
        source: true,
        sourceType: true,
        createdAt: true,
        updatedAt: true,
        builds: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, imageTag: true, durationMs: true, cacheHit: true, createdAt: true },
        },
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
    await this.prisma.deployment.delete({ where: { id } });
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

  async redeploy(id: string) {
    const deployment = await this.findOne(id);
    await this.pipeline.stop(deployment.id, deployment.containerId);
    await this.prisma.deployment.update({
      where: { id },
      data: { status: 'pending', containerId: null, port: null, url: null, routeId: null },
    });
    await this.queue.addDeploymentJob(id);
    return { queued: true };
  }

  getBuilds(id: string) {
    return this.prisma.build.findMany({
      where: { deploymentId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  getEvents(id: string) {
    return this.events.getEvents(id);
  }

  private slugify(name: string): string {
    return (
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'app'
    );
  }
}
