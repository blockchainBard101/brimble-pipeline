import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { MetricsService } from './metrics.service';
import { PrismaService } from '../database/prisma.service';

@Controller('deployments')
export class MetricsController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get(':id/metrics')
  async streamMetrics(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const deployment = await this.prisma.deployment.findUnique({ where: { id } });
    if (!deployment || deployment.status !== 'running') {
      res.status(404).json({ error: 'Deployment not running' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sub = this.metricsService.getMetricsStream(id).subscribe({
      next: (m) => res.write(`data: ${JSON.stringify(m)}\n\n`),
      error: () => res.end(),
      complete: () => res.end(),
    });

    req.on('close', () => sub.unsubscribe());
  }
}
