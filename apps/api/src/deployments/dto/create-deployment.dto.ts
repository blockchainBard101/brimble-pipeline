export class CreateDeploymentDto {
  name: string;
  source: string;
  sourceType: 'git' | 'upload';
  envVars?: { key: string; value: string }[];
}
