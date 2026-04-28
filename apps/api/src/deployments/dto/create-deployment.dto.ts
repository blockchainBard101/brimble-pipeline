import { EnvVarInputDto } from './env-var.dto';

export class CreateDeploymentDto {
  name: string;
  source: string;
  sourceType: 'git' | 'upload';
  envVars?: EnvVarInputDto[];
}
