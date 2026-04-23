import { Module } from '@nestjs/common';
import { DeploymentsController } from './deployments.controller';
import { DeploymentsService } from './deployments.service';
import { PipelineModule } from '../pipeline/pipeline.module';
import { LogsModule } from '../logs/logs.module';

@Module({
  imports: [PipelineModule, LogsModule],
  controllers: [DeploymentsController],
  providers: [DeploymentsService],
  exports: [DeploymentsService],
})
export class DeploymentsModule {}
