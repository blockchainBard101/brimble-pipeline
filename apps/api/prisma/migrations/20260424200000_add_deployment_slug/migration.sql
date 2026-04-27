ALTER TABLE "Deployment" ADD COLUMN "slug" TEXT;
CREATE UNIQUE INDEX "Deployment_slug_key" ON "Deployment"("slug");
