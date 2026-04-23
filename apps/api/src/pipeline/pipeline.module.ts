import { Module } from '@nestjs/common';
import { PipelineService } from './pipeline.service';
import { DockerService } from './docker.service';
import { CaddyService } from './caddy.service';
import { HealthService } from './health.service';
import { LogsModule } from '../logs/logs.module';
import { PortsModule } from '../ports/ports.module';

@Module({
  imports: [LogsModule, PortsModule],
  providers: [PipelineService, DockerService, CaddyService, HealthService],
  exports: [PipelineService, DockerService, CaddyService, HealthService],
})
export class PipelineModule {}
