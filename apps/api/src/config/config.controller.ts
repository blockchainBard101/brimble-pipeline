import { Controller, Get } from '@nestjs/common';

@Controller('config')
export class ConfigController {
  @Get('webhook-url')
  getWebhookUrl(): { webhookUrl: string; events: string[] } {
    const base = process.env.API_BASE_URL ?? 'http://localhost:7401';
    return { webhookUrl: `${base}/webhooks/github`, events: ['push'] };
  }
}
