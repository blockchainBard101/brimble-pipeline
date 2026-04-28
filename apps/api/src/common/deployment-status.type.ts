export type DeploymentStatus =
  | 'pending'
  | 'building'
  | 'deploying'
  | 'health_check'
  | 'routing'
  | 'running'
  | 'failed'
  | 'stopped';
