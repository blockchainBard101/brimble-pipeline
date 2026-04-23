export class CreateDeploymentDto {
  name: string;
  source: string;
  sourceType: 'git' | 'upload';
}
