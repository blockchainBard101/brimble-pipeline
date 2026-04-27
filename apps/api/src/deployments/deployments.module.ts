import { Module } from '@nestjs/common';
import { DeploymentsController } from './deployments.controller';
import { DeploymentsService } from './deployments.service';
import { EnvVarsModule } from './env-vars.module';
import { QueueModule } from '../queue/queue.module';
import { PipelineModule } from '../pipeline/pipeline.module';
import { LogsModule } from '../logs/logs.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [QueueModule, PipelineModule, LogsModule, EventsModule, EnvVarsModule],
  controllers: [DeploymentsController],
  providers: [DeploymentsService],
  exports: [DeploymentsService],
})
export class DeploymentsModule {}
