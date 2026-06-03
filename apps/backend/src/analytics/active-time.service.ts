import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ActiveTimeService {
  constructor(private readonly prisma: PrismaService) {}

  async getActivitySummary(orgId: string, days = 7, targetUserId?: string, fromDate?: string, toDate?: string) {
    let from = new Date();
    let to: Date | undefined;
    if (fromDate) {
      // Используем UTC чтобы не зависеть от timezone сервера
      from = new Date(fromDate + 'T00:00:00.000Z');
    } else if (days === 1) {
      // Начало сегодняшнего дня UTC
      from.setUTCHours(0, 0, 0, 0);
    } else {
      from.setDate(from.getDate() - days);
      from.setUTCHours(0, 0, 0, 0);
    }
    if (toDate) {
      to = new Date(toDate + 'T23:59:59.999Z');
    }

    const events = await this.prisma.activityEvent.findMany({
      where: { orgId, createdAt: { gte: from, ...(to ? { lte: to } : {}) }, ...(targetUserId ? { userId: targetUserId } : {}) },
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
        lastPingSeconds: number;
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

      // Day grouping — используем clientTimestamp (время браузера), не серверное время
      const day = new Date(e.clientTimestamp).toISOString().slice(0, 10);
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
          user.sections[sectionKey] = { events: 0, timeSeconds: 0, actions: {}, lastEnter: 0, lastPingSeconds: 0 };
        }
        const sec = user.sections[sectionKey];
        sec.events++;

        // Track section enter time
        if (e.eventType === 'wb_section_enter' || e.eventType === 'ozon_section_enter') {
          sec.lastEnter = Number(e.clientTimestamp);
          sec.lastPingSeconds = 0; // сбрасываем при входе в раздел
        }
        // Track section leave → use pre-calculated time from extension if available
        if (e.eventType === 'wb_section_leave' || e.eventType === 'ozon_section_leave') {
          const activeS = pd?.activeSeconds;
          const spentS  = pd?.timeSpentSeconds;
          const leaveTime = activeS || spentS || 0;
          if (leaveTime > 0 && leaveTime < 7200) {
            // НАКАПЛИВАЕМ время каждого визита, не заменяем
            // Вычитаем уже записанное через ping чтобы не задвоить
            const alreadyCounted = sec.lastPingSeconds ?? 0;
            const toAdd = Math.max(0, leaveTime - alreadyCounted);
            sec.timeSeconds += toAdd;
          } else if (leaveTime === 0 && sec.lastEnter > 0) {
            const calc = Math.round((Number(e.clientTimestamp) - sec.lastEnter) / 1000);
            if (calc > 0 && calc < 7200) sec.timeSeconds += calc;
          }
          sec.lastEnter = 0;
          sec.lastPingSeconds = 0;
        }
        // Use section_ping to track time for sessions without navigation
        if (e.eventType === 'wb_section_ping' || e.eventType === 'ozon_section_ping') {
          const activeS = pd?.activeSeconds;
          if (activeS && activeS > 0 && activeS < 7200) {
            const diff = activeS - (sec.lastPingSeconds ?? 0);
            if (diff > 0) {
              sec.timeSeconds += diff;
            }
            sec.lastPingSeconds = activeS;
          }
        }
        // Track specific actions
        if (e.eventType && (e.eventType.startsWith('wb_') || e.eventType.startsWith('ozon_'))) {
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
      totalEstimatedMins: Math.round(
        Object.values(data.sections).reduce((s, sec) => s + sec.timeSeconds, 0) / 60
      ),
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

  async getHourlyActivity(orgId: string, userId?: string, days = 7) {
    const from = new Date();
    if (days === 1) {
      from.setUTCHours(0, 0, 0, 0);
    } else {
      from.setDate(from.getDate() - days);
      from.setUTCHours(0, 0, 0, 0);
    }

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
