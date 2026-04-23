import { Module } from '@nestjs/common';
import { PipelineService } from './pipeline.service';
import { DockerService } from './docker.service';
import { CaddyService } from './caddy.service';
import { LogsModule } from '../logs/logs.module';

@Module({
  imports: [LogsModule],
  providers: [PipelineService, DockerService, CaddyService],
  exports: [PipelineService, DockerService, CaddyService],
})
export class PipelineModule {}
