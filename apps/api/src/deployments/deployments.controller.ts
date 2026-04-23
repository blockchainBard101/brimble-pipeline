import {
  Controller,
  Get,
  Post,
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
import { CreateDeploymentDto } from './dto/create-deployment.dto';

@Controller('deployments')
export class DeploymentsController {
  constructor(
    private readonly deploymentsService: DeploymentsService,
    private readonly logsService: LogsService,
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

  @Sse(':id/logs')
  streamLogs(@Param('id') id: string): Observable<MessageEvent> {
    return this.logsService.getStream(id).pipe(
      map((line) => ({ data: line }) as MessageEvent),
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.deploymentsService.remove(id);
  }
}
