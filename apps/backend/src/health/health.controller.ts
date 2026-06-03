import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/decorators/index';

@Controller('api/v1/health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status:   'ok',
        ts:       new Date().toISOString(),
        db:       'ok',
        dbMs:     Date.now() - start,
        uptime:   Math.round(process.uptime()),
        memMb:    Math.round(process.memoryUsage().rss / 1024 / 1024),
        version:  process.env.npm_package_version ?? '1.0.0',
      };
    } catch (e) {
      return { status: 'error', db: 'fail', ts: new Date().toISOString() };
    }
  }
}
