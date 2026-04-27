-- Drop existing RESTRICT foreign keys and recreate with CASCADE

ALTER TABLE "Log" DROP CONSTRAINT "Log_deploymentId_fkey";
ALTER TABLE "Log" ADD CONSTRAINT "Log_deploymentId_fkey"
  FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Build" DROP CONSTRAINT "Build_deploymentId_fkey";
ALTER TABLE "Build" ADD CONSTRAINT "Build_deploymentId_fkey"
  FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DeploymentEvent" DROP CONSTRAINT "DeploymentEvent_deploymentId_fkey";
ALTER TABLE "DeploymentEvent" ADD CONSTRAINT "DeploymentEvent_deploymentId_fkey"
  FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EnvVar" DROP CONSTRAINT "EnvVar_deploymentId_fkey";
ALTER TABLE "EnvVar" ADD CONSTRAINT "EnvVar_deploymentId_fkey"
  FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
