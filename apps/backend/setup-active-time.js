const fs = require('fs');
const path = require('path');

function write(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log('✓', filePath);
}

// ─── Backend: Active time endpoint ───────────────────────────
write('src/analytics/active-time.service.ts', `import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ActiveTimeService {
  constructor(private readonly prisma: PrismaService) {}

  async getActivitySummary(orgId: string, days = 7) {
    const from = new Date();
    from.setDate(from.getDate() - days);
    from.setHours(0, 0, 0, 0);

    const events = await this.prisma.activityEvent.findMany({
      where: { orgId, createdAt: { gte: from } },
      select: {
        userId: true, platform: true,
        clientTimestamp: true, createdAt: true,
        platformData: true,
      },
      orderBy: { clientTimestamp: 'asc' },
    });

    // Group by user and day
    const byUserDay: Record<string, Record<string, {
      events: number; platforms: Record<string, number>;
    }>> = {};

    for (const e of events) {
      const day = e.createdAt.toISOString().slice(0, 10);
      if (!byUserDay[e.userId]) byUserDay[e.userId] = {};
      if (!byUserDay[e.userId][day]) byUserDay[e.userId][day] = { events: 0, platforms: {} };
      byUserDay[e.userId][day].events++;
      const plat = e.platform ?? 'OTHER';
      byUserDay[e.userId][day].platforms[plat] = (byUserDay[e.userId][day].platforms[plat] ?? 0) + 1;
    }

    // Get user names
    const userIds = Object.keys(byUserDay);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });
    const userMap = Object.fromEntries(users.map(u => [u.id, u.name]));

    return Object.entries(byUserDay).map(([userId, days]) => ({
      userId,
      name: userMap[userId] ?? 'Unknown',
      days: Object.entries(days).map(([date, data]) => ({
        date,
        eventCount: data.events,
        // Estimate active minutes: ~2s per event / 60
        estimatedActiveMins: Math.round(data.events * 2 / 60),
        platforms: data.platforms,
      })),
      totalEvents: Object.values(days).reduce((s, d) => s + d.events, 0),
      totalEstimatedMins: Object.values(days).reduce((s, d) => s + Math.round(d.events * 2 / 60), 0),
    }));
  }

  async getPlatformBreakdown(orgId: string, days = 7) {
    const from = new Date();
    from.setDate(from.getDate() - days);

    const events = await this.prisma.activityEvent.groupBy({
      by:    ['platform'],
      where: { orgId, createdAt: { gte: from } },
      _count: { id: true },
    });

    const total = events.reduce((s, e) => s + e._count.id, 0);
    return events.map(e => ({
      platform: e.platform,
      events:   e._count.id,
      percent:  total > 0 ? Math.round(e._count.id / total * 100) : 0,
      estimatedMins: Math.round(e._count.id * 2 / 60),
    }));
  }

  async getHourlyActivity(orgId: string, userId?: string) {
    const from = new Date();
    from.setDate(from.getDate() - 7);

    const where: any = { orgId, createdAt: { gte: from } };
    if (userId) where.userId = userId;

    const events = await this.prisma.activityEvent.findMany({
      where,
      select: { clientTimestamp: true },
    });

    // Count by hour of day (0-23)
    const hourCounts = new Array(24).fill(0);
    for (const e of events) {
      const hour = new Date(e.clientTimestamp).getHours();
      hourCounts[hour]++;
    }

    return hourCounts.map((count, hour) => ({
      hour,
      label: hour + ':00',
      events: count,
      estimatedMins: Math.round(count * 2 / 60),
    }));
  }

  async getTotalEventCount(orgId: string) {
    return this.prisma.activityEvent.count({ where: { orgId } });
  }
}
`);

// ─── Update analytics controller ─────────────────────────────
write('src/analytics/analytics.controller.ts', `import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { ActiveTimeService } from './active-time.service';
import { CurrentUser } from '../auth/decorators/index';

@Controller('api/v1/analytics')
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly activeTime: ActiveTimeService,
  ) {}

  @Get('stats')
  getStats(@CurrentUser() user: any) {
    return this.analytics.getOrgStats(user.orgId);
  }

  @Get('tasks/by-status')
  getByStatus(@CurrentUser() user: any) {
    return this.analytics.getTasksByStatus(user.orgId);
  }

  @Get('tasks/by-priority')
  getByPriority(@CurrentUser() user: any) {
    return this.analytics.getTasksByPriority(user.orgId);
  }

  @Get('tasks/by-day')
  getByDay(@CurrentUser() user: any, @Query('days') days?: string) {
    return this.analytics.getTasksCreatedByDay(user.orgId, days ? parseInt(days) : 14);
  }

  @Get('employees')
  getEmployeeStats(@CurrentUser() user: any) {
    return this.analytics.getEmployeeStats(user.orgId);
  }

  @Get('activity/summary')
  getActivitySummary(@CurrentUser() user: any, @Query('days') days?: string) {
    return this.activeTime.getActivitySummary(user.orgId, days ? parseInt(days) : 7);
  }

  @Get('activity/platforms')
  getPlatformBreakdown(@CurrentUser() user: any, @Query('days') days?: string) {
    return this.activeTime.getPlatformBreakdown(user.orgId, days ? parseInt(days) : 7);
  }

  @Get('activity/hourly')
  getHourlyActivity(@CurrentUser() user: any, @Query('userId') userId?: string) {
    return this.activeTime.getHourlyActivity(user.orgId, userId);
  }

  @Get('activity/total')
  getTotalEvents(@CurrentUser() user: any) {
    return this.activeTime.getTotalEventCount(user.orgId);
  }
}
`);

// ─── Update analytics module ──────────────────────────────────
write('src/analytics/analytics.module.ts', `import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { ActiveTimeService } from './active-time.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, ActiveTimeService],
})
export class AnalyticsModule {}
`);

console.log('\n✅ Active time backend created');
