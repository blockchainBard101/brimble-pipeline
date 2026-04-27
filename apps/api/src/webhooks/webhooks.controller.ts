import {
  Controller,
  Post,
  Headers,
  Req,
  HttpCode,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import * as crypto from 'crypto';
import { WebhooksService } from './webhooks.service';
import { GitHubPushPayload } from './github.types';

type RawRequest = Request & { rawBody?: Buffer };

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('github')
  @HttpCode(200)
  async handleGitHub(
    @Req() req: RawRequest,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Headers('x-github-event') event: string | undefined,
  ): Promise<{ ok: boolean }> {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (secret) {
      if (!signature || !req.rawBody) throw new UnauthorizedException('Missing signature');
      const expected = `sha256=${crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex')}`;
      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        throw new UnauthorizedException('Invalid signature');
      }
    }

    if (event !== 'push') return { ok: true };

    await this.webhooksService.handlePush(req.body as GitHubPushPayload);
    return { ok: true };
  }
}
