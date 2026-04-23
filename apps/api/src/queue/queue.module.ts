import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueService } from './queue.service';
import { DeploymentProcessor } from './deployment.processor';
import { PipelineModule } from '../pipeline/pipeline.module';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          host: process.env.REDIS_HOST ?? 'localhost',
          port: Number(process.env.REDIS_PORT ?? 6379),
        },
      }),
    }),
    BullModule.registerQueue({ name: 'deployments' }),
    PipelineModule,
  ],
  providers: [QueueService, DeploymentProcessor],
  exports: [QueueService],
})
export class QueueModule {}
