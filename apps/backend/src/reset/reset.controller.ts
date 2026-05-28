import { Controller, Post, UseGuards, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/index';
import { CurrentUser } from '../auth/decorators/index';
import { PrismaService } from '../prisma/prisma.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Controller('api/v1/reset')
@UseGuards(JwtAuthGuard)
export class ResetController {
  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  @Post()
  async resetAll(@CurrentUser() user: any) {
    if (!user?.roles?.includes('ADMIN') && !user?.roles?.includes('SUPER_ADMIN')) {
      throw new ForbiddenException('Access denied');
    }

    const orgId = user.orgId;

    // Clear activity events
    await this.prisma.activityEvent.deleteMany({ where: { orgId } });

    // Clear analytics
    await this.prisma.analyticsHourly.deleteMany({ where: { orgId } }).catch(() => {});

    // Clear realtime status
    await this.prisma.realtimeStatus.deleteMany({ where: { orgId } }).catch(() => {});

    // Clear tasks (keep structure)
    await this.prisma.taskHistory.deleteMany({ where: { task: { orgId } } }).catch(() => {});
    await this.prisma.taskComment.deleteMany({ where: { task: { orgId } } }).catch(() => {});
    await this.prisma.task.deleteMany({ where: { orgId } }).catch(() => {});

    // Clear work sessions from redis
    const keys = await this.redis.keys(`work:session:*`);
    if (keys.length > 0) await this.redis.del(...keys);

    // Clear presence from redis
    const presenceKeys = await this.redis.keys(`presence:*`);
    if (presenceKeys.length > 0) await this.redis.del(...presenceKeys);

    return {
      success: true,
      message: 'Все данные очищены',
      cleared: ['activityEvents', 'analytics', 'realtimeStatus', 'tasks', 'workSessions', 'presence']
    };
  }
}
