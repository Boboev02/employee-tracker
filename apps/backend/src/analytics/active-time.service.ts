import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ActiveTimeService {
  constructor(private readonly prisma: PrismaService) {}

  async getActivitySummary(orgId: string, days = 7, targetUserId?: string) {
    const from = new Date();
    from.setDate(from.getDate() - days);
    from.setHours(0, 0, 0, 0);

    const events = await this.prisma.activityEvent.findMany({
      where: { orgId, createdAt: { gte: from }, ...(targetUserId ? { userId: targetUserId } : {}) },
      select: {
        userId: true, platform: true,
        clientTimestamp: true, createdAt: true,
        eventType: true,
        platformData: true,
      },
      orderBy: { clientTimestamp: 'asc' },
    });

    // Group by user
    const byUser: Record<string, {
      events: number;
      platforms: Record<string, number>;
      sections: Record<string, {
        events: number;
        timeSeconds: number;
        actions: Record<string, number>;
        lastEnter: number;
      }>;
      days: Record<string, { events: number; platforms: Record<string, number> }>;
    }> = {};

    for (const e of events) {
      if (!byUser[e.userId]) {
        byUser[e.userId] = { events: 0, platforms: {}, sections: {}, days: {} };
      }
      const user = byUser[e.userId];

      // Day grouping
      const day = e.createdAt.toISOString().slice(0, 10);
      if (!user.days[day]) user.days[day] = { events: 0, platforms: {} };
      user.days[day].events++;
      const plat = e.platform ?? 'OTHER';
      user.days[day].platforms[plat] = (user.days[day].platforms[plat] ?? 0) + 1;

      user.events++;
      user.platforms[plat] = (user.platforms[plat] ?? 0) + 1;

      // Section grouping from platformData
      const pd = e.platformData as any;
      if (pd?.section && pd.section !== 'other' && pd.section !== 'unknown') {
        const sectionKey = plat + ':' + pd.section;
        if (!user.sections[sectionKey]) {
          user.sections[sectionKey] = { events: 0, timeSeconds: 0, actions: {}, lastEnter: 0 };
        }
        const sec = user.sections[sectionKey];
        sec.events++;

        // Track section enter time
        if (e.eventType === 'wb_section_enter' || e.eventType === 'ozon_section_enter') {
          sec.lastEnter = Number(e.clientTimestamp);
        }
        // Track section leave → use pre-calculated time from extension if available
        if (e.eventType === 'wb_section_leave' || e.eventType === 'ozon_section_leave') {
          // Prefer activeSeconds (excludes idle), fallback to timeSpentSeconds, fallback to calculated
          const activeS = pd?.activeSeconds;
          const spentS  = pd?.timeSpentSeconds;
          if (activeS && activeS > 0 && activeS < 7200) {
            sec.timeSeconds += activeS;
          } else if (spentS && spentS > 0 && spentS < 7200) {
            sec.timeSeconds += spentS;
          } else if (sec.lastEnter > 0) {
            const calc = Math.round((Number(e.clientTimestamp) - sec.lastEnter) / 1000);
            if (calc > 0 && calc < 7200) sec.timeSeconds += calc;
          }
          sec.lastEnter = 0;
        }
        // Also count section_ping events for real-time time tracking
        if (e.eventType === 'wb_section_ping' || e.eventType === 'ozon_section_ping') {
          const activeS = pd?.activeSeconds;
          if (activeS && activeS > 0 && activeS < 7200) {
            // Don't double-count: only add if no previous leave recorded
            // pings are incremental, just update the running total marker
          }
        }
        // Track specific actions
        if (e.eventType && e.eventType.startsWith('wb_') || e.eventType && e.eventType.startsWith('ozon_')) {
          const skip = ['wb_section_enter','wb_section_leave','ozon_section_enter','ozon_section_leave'];
          if (!skip.includes(e.eventType)) {
            sec.actions[e.eventType] = (sec.actions[e.eventType] ?? 0) + 1;
          }
        }
      }
    }

    // Get user names
    const userIds = Object.keys(byUser);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });
    const userMap = Object.fromEntries(users.map(u => [u.id, u.name]));

    return Object.entries(byUser).map(([userId, data]) => ({
      userId,
      name: userMap[userId] ?? 'Unknown',
      totalEvents: data.events,
      totalEstimatedMins: Object.values(data.days).reduce((s, d) => s + Math.round(d.events * 2 / 60), 0),
      activeDays: Object.keys(data.days).length,
      sections: data.sections,
      days: Object.entries(data.days).map(([date, d]) => ({
        date,
        eventCount: d.events,
        estimatedActiveMins: Math.round(d.events * 2 / 60),
        platforms: d.platforms,
      })),
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
