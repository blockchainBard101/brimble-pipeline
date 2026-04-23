import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PipelineService } from '../pipeline/pipeline.service';
import { PrismaService } from '../database/prisma.service';

interface DeploymentJobData {
  deploymentId: string;
}

@Processor('deployments')
export class DeploymentProcessor extends WorkerHost {
  constructor(
    private readonly pipeline: PipelineService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<DeploymentJobData>): Promise<void> {
    const { deploymentId } = job.data;
    try {
      await this.pipeline.run(deploymentId);
    } catch (err) {
      await this.prisma.deployment
        .update({ where: { id: deploymentId }, data: { status: 'failed' } })
        .catch(() => {});
      throw err;
    }
  }
}
