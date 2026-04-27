import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { DeploymentsService } from './deployments.service';
import { LogsService } from '../logs/logs.service';
import { EnvVarsService } from './env-vars.service';
import { CreateDeploymentDto } from './dto/create-deployment.dto';
import { UpdateEnvVarsDto } from './dto/env-var.dto';

class RollbackDto {
  imageTag: string;
}

@Controller('deployments')
export class DeploymentsController {
  constructor(
    private readonly deploymentsService: DeploymentsService,
    private readonly logsService: LogsService,
    private readonly envVarsService: EnvVarsService,
  ) {}

  @Post()
  create(@Body() dto: CreateDeploymentDto) {
    return this.deploymentsService.create(dto);
  }

  @Get()
  findAll() {
    return this.deploymentsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.deploymentsService.findOne(id);
  }

  @Get(':id/builds')
  getBuilds(@Param('id') id: string) {
    return this.deploymentsService.getBuilds(id);
  }

  @Get(':id/events')
  getEvents(@Param('id') id: string) {
    return this.deploymentsService.getEvents(id);
  }

  @Get(':id/env')
  getEnvVars(@Param('id') id: string) {
    return this.envVarsService.getMasked(id);
  }

  @Patch(':id/env')
  async updateEnvVars(@Param('id') id: string, @Body() dto: UpdateEnvVarsDto) {
    await this.envVarsService.setEnvVars(id, dto.vars);
    await this.deploymentsService.redeploy(id);
    return { updated: true };
  }

  @Post(':id/redeploy')
  redeploy(@Param('id') id: string) {
    return this.deploymentsService.redeploy(id);
  }

  @Post(':id/rollback')
  rollback(@Param('id') id: string, @Body() dto: RollbackDto) {
    return this.deploymentsService.rollback(id, dto.imageTag);
  }

  @Sse(':id/logs')
  streamLogs(@Param('id') id: string): Observable<MessageEvent> {
    return this.logsService.getStream(id).pipe(
      map((entry) => ({ data: JSON.stringify(entry) }) as MessageEvent),
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.deploymentsService.remove(id);
  }
}
