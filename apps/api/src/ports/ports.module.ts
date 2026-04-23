import { Module } from '@nestjs/common';
import { PortsService } from './ports.service';

@Module({
  providers: [PortsService],
  exports: [PortsService],
})
export class PortsModule {}
