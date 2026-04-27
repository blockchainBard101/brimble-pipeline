ALTER TABLE "Build" ADD COLUMN "durationMs" INTEGER;
ALTER TABLE "Build" ADD COLUMN "cacheHit" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "DeploymentEvent" (
    "id" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeploymentEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DeploymentEvent" ADD CONSTRAINT "DeploymentEvent_deploymentId_fkey"
  FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
