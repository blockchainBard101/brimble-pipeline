import { Module } from '@nestjs/common';
import { PipelineService } from './pipeline.service';
import { DockerService } from './docker.service';
import { CaddyService } from './caddy.service';
import { HealthService } from './health.service';
import { LogsModule } from '../logs/logs.module';
import { PortsModule } from '../ports/ports.module';
import { MetricsModule } from '../metrics/metrics.module';
import { EventsModule } from '../events/events.module';
import { EnvVarsModule } from '../deployments/env-vars.module';

@Module({
  imports: [LogsModule, PortsModule, MetricsModule, EventsModule, EnvVarsModule],
  providers: [PipelineService, DockerService, CaddyService, HealthService],
  exports: [PipelineService, DockerService, CaddyService, HealthService],
})
export class PipelineModule {}
