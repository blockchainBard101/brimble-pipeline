import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class QueueService {
  constructor(@InjectQueue('deployments') private readonly queue: Queue) {}

  async addDeploymentJob(deploymentId: string): Promise<void> {
    await this.queue.add(
      'run',
      { deploymentId },
      {
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }
}
