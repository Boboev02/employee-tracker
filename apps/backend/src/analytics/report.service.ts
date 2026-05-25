import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  async getFullReport(orgId: string, days: number) {
    const from = new Date();
    from.setDate(from.getDate() - days);
    from.setHours(0, 0, 0, 0);

    const [users, tasks, events] = await Promise.all([
      this.prisma.user.findMany({ where: { orgId }, select: { id: true, name: true, email: true, status: true, userRoles: { select: { role: true } } } }),
      this.prisma.task.findMany({ where: { orgId, deletedAt: null }, select: { id: true, title: true, status: true, priority: true, assigneeId: true, createdAt: true, dueDate: true } }),
      this.prisma.activityEvent.findMany({ where: { orgId, createdAt: { gte: from } }, select: { userId: true, platform: true, eventType: true, platformData: true, clientTimestamp: true } }),
    ]);

    const userMap = Object.fromEntries(users.map(u => [u.id, u]));
    const userStats: Record<string, any> = {};

    for (const u of users) {
      userStats[u.id] = { id: u.id, name: u.name, email: u.email, role: (u as any).userRoles?.[0]?.role?.name ?? (u as any).userRoles?.[0]?.role ?? 'EMPLOYEE', totalClicks: 0, platforms: {}, sections: {}, tasks: { inProgress: 0, done: 0, other: 0 }, lastEnter: {} };
    }

    for (const e of events) {
      const s = userStats[e.userId];
      if (!s) continue;
      const plat = e.platform ?? 'OTHER';
      s.platforms[plat] = (s.platforms[plat] ?? 0) + 1;
      if (e.eventType === 'click') s.totalClicks++;
      const pd = e.platformData as any;
      if (pd?.section && pd.section !== 'other' && pd.section !== 'unknown') {
        const key = plat + ':' + pd.section;
        if (!s.sections[key]) s.sections[key] = { clicks: 0, timeSeconds: 0 };
        if (e.eventType === 'click') s.sections[key].clicks++;
        if (e.eventType?.includes('section_enter')) s.lastEnter[key] = Number(e.clientTimestamp);
        if (e.eventType?.includes('section_leave') && s.lastEnter[key]) {
          const spent = Math.round((Number(e.clientTimestamp) - s.lastEnter[key]) / 1000);
          if (spent > 0 && spent < 7200) s.sections[key].timeSeconds += spent;
          delete s.lastEnter[key];
        }
      }
    }

    for (const t of tasks) {
      if (t.assigneeId && userStats[t.assigneeId]) {
        const s = userStats[t.assigneeId];
        if (t.status === 'IN_PROGRESS') s.tasks.inProgress++;
        else if (t.status === 'DONE') s.tasks.done++;
        else s.tasks.other++;
      }
    }

    const LABELS: Record<string, string> = { orders:'Заказы', feedbacks:'Отзывы', reviews:'Отзывы', questions:'Вопросы', products:'Товары', prices:'Цены', stocks:'Остатки', remains:'Остатки', supplies:'Поставки', supply:'Поставки', advertising:'Реклама', analytics:'Аналитика', finance:'Финансы', chat:'Чат', promotions:'Акции', promotion:'Продвижение', logistics:'Логистика', rating:'Рейтинг', other:'Прочее' };

    return {
      period: { days, from: from.toISOString(), to: new Date().toISOString() },
      generatedAt: new Date().toISOString(),
      summary: { totalEmployees: users.length, totalClicks: events.filter(e => e.eventType === 'click').length, totalTasks: tasks.length, completedTasks: tasks.filter(t => t.status === 'DONE').length },
      employees: Object.values(userStats).map((s: any) => ({
        ...s,
        sectionsFormatted: Object.entries(s.sections).map(([key, val]: [string, any]) => {
          const [plat, section] = key.split(':');
          return { platform: plat, section, label: LABELS[section] ?? section, ...val };
        }).sort((a: any, b: any) => b.clicks - a.clicks),
      })),
      tasks: tasks.map(t => ({ ...t, assigneeName: t.assigneeId ? userMap[t.assigneeId]?.name ?? '—' : '—' })),
    };
  }
}
