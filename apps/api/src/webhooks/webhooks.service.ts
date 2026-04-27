import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { DeploymentsService } from '../deployments/deployments.service';
import { GitHubPushPayload } from './github.types';

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly deployments: DeploymentsService,
  ) {}

  async handlePush(payload: GitHubPushPayload): Promise<void> {
    if (payload.ref !== `refs/heads/${payload.repository.default_branch}`) return;

    const repoUrl = payload.repository.clone_url;

    const existing = await this.prisma.deployment.findFirst({
      where: { source: repoUrl, sourceType: 'git', status: { not: 'stopped' } },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      await this.deployments.redeploy(existing.id);
    } else {
      await this.deployments.create({
        name: payload.repository.name,
        source: repoUrl,
        sourceType: 'git',
      });
    }
  }
}
