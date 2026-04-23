import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { DeploymentsModule } from './deployments/deployments.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { LogsModule } from './logs/logs.module';

@Module({
  imports: [DatabaseModule, DeploymentsModule, PipelineModule, LogsModule],
})
export class AppModule {}
