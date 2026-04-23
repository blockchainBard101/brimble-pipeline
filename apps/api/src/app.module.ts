import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { DeploymentsModule } from './deployments/deployments.module';

@Module({
  // DeploymentsModule transitively imports QueueModule → PipelineModule → LogsModule + PortsModule.
  imports: [DatabaseModule, DeploymentsModule],
})
export class AppModule {}
