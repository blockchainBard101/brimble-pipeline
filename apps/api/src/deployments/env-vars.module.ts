import { Module } from '@nestjs/common';
import { EnvVarsService } from './env-vars.service';

@Module({
  providers: [EnvVarsService],
  exports: [EnvVarsService],
})
export class EnvVarsModule {}
