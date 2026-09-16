import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const ACTIVE_STATUSES = ['NEW', 'IN_PROGRESS', 'REVIEW', 'BLOCKED', 'OVERDUE'];
const STALE_DAYS = 3;

@Injectable()
export class CommandCenterService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(orgId: string) {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 3600_000);
    const staleBefore = new Date(now.getTime() - STALE_DAYS * 24 * 3600_000);

    const alive = { orgId, deletedAt: null };
    const active = { ...alive, status: { in: ACTIVE_STATUSES } };

    const [
      overdue, unassigned, stale, closedLast24h,
      createdLast24h, totalActive,
      overdueTasks, unassignedTasks,
      users, online, activeByUser, overdueByUser,
      projects, tasksByProject, doneByProject,
    ] = await Promise.all([
      this.prisma.task.count({ where: { ...active, dueDate: { lt: now } } }),
      this.prisma.task.count({ where: { ...active, assigneeId: null } }),
      this.prisma.task.count({ where: { ...active, updatedAt: { lt: staleBefore } } }),
      this.prisma.task.count({ where: { orgId, completedAt: { gte: dayAgo } } }),
      this.prisma.task.count({ where: { ...alive, createdAt: { gte: dayAgo } } }),
      this.prisma.task.count({ where: active }),

      // Списки для блока «Требует внимания» — с жёстким потолком
      this.prisma.task.findMany({
        where: { ...active, dueDate: { lt: now } },
        orderBy: { dueDate: 'asc' },
        take: 5,
        select: {
          id: true, title: true, dueDate: true,
          assignee: { select: { id: true, name: true } },
          project:  { select: { id: true, name: true } },
        },
      }),
      this.prisma.task.findMany({
        where: { ...active, assigneeId: null },
        orderBy: { createdAt: 'asc' },
        take: 5,
        select: {
          id: true, title: true, createdAt: true,
          project: { select: { id: true, name: true } },
        },
      }),

      this.prisma.user.findMany({
        where: { orgId, deletedAt: null, status: { not: 'SUSPENDED' } },
        select: { id: true, name: true, avatarUrl: true, position: true },
        take: 100,
      }),
      this.prisma.realtimeStatus.findMany({
        where: { orgId, status: { not: 'OFFLINE' } },
        select: { userId: true, status: true, lastActivityAt: true },
      }),
      this.prisma.task.groupBy({
        by: ['assigneeId'],
        where: { ...active, assigneeId: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.task.groupBy({
        by: ['assigneeId'],
        where: { ...active, assigneeId: { not: null }, dueDate: { lt: now } },
        _count: { _all: true },
      }),

      this.prisma.project.findMany({
        where: { orgId, deletedAt: null, status: 'ACTIVE' },
        select: { id: true, name: true, startDate: true, dueDate: true, color: true },
        take: 50,
      }),
      this.prisma.task.groupBy({
        by: ['projectId'],
        where: { ...alive, projectId: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.task.groupBy({
        by: ['projectId'],
        where: { ...alive, projectId: { not: null }, status: 'DONE' },
        _count: { _all: true },
      }),
    ]);

    // ─── команда ───
    const onlineMap = new Map(online.map(o => [o.userId, o]));
    const activeMap = new Map(activeByUser.map(g => [g.assigneeId, g._count._all]));
    const odMap     = new Map(overdueByUser.map(g => [g.assigneeId, g._count._all]));

    const team = users
      .map(u => ({
        id: u.id,
        name: u.name,
        avatarUrl: u.avatarUrl,
        position: u.position,
        online: onlineMap.has(u.id),
        lastActivityAt: onlineMap.get(u.id)?.lastActivityAt ?? null,
        activeTasks: activeMap.get(u.id) ?? 0,
        overdueTasks: odMap.get(u.id) ?? 0,
      }))
      .sort((a, b) => b.overdueTasks - a.overdueTasks || b.activeTasks - a.activeTasks);

    // ─── проекты: доля срока против доли закрытых задач ───
    const totalMap = new Map(tasksByProject.map(g => [g.projectId, g._count._all]));
    const doneMap  = new Map(doneByProject.map(g => [g.projectId, g._count._all]));

    const projectProgress = projects.map(p => {
      const total = totalMap.get(p.id) ?? 0;
      const done  = doneMap.get(p.id) ?? 0;
      const donePct = total ? Math.round((done * 100) / total) : 0;

      let timePct: number | null = null;
      if (p.startDate && p.dueDate) {
        const span = new Date(p.dueDate).getTime() - new Date(p.startDate).getTime();
        if (span > 0) {
          const passed = now.getTime() - new Date(p.startDate).getTime();
          timePct = Math.min(100, Math.max(0, Math.round((passed * 100) / span)));
        }
      }
      return {
        id: p.id, name: p.name, color: p.color,
        dueDate: p.dueDate,
        totalTasks: total, doneTasks: done,
        donePct, timePct,
        // отставание считаем только когда есть обе даты и срок реально идёт
        behind: timePct !== null && timePct > 25 && timePct - donePct >= 20,
      };
    });

    // ─── сигналы ───
    const signals: any[] = [];

    for (const t of overdueTasks) {
      const days = Math.max(1, Math.floor((now.getTime() - new Date(t.dueDate!).getTime()) / 86400_000));
      signals.push({
        kind: 'overdue',
        severity: 'critical',
        title: `${t.title} — просрочена на ${days} ${plural(days, 'день', 'дня', 'дней')}`,
        subtitle: [t.project?.name, t.assignee?.name ?? 'без исполнителя'].filter(Boolean).join(' · '),
        entityType: 'TASK', entityId: t.id,
      });
    }

    for (const t of unassignedTasks) {
      const days = Math.floor((now.getTime() - new Date(t.createdAt).getTime()) / 86400_000);
      signals.push({
        kind: 'unassigned',
        severity: 'warning',
        title: `${t.title} — нет исполнителя`,
        subtitle: [t.project?.name, days > 0 ? `создана ${days} ${plural(days, 'день', 'дня', 'дней')} назад` : 'создана сегодня']
          .filter(Boolean).join(' · '),
        entityType: 'TASK', entityId: t.id,
      });
    }

    for (const p of projectProgress.filter(p => p.behind).slice(0, 3)) {
      signals.push({
        kind: 'project_behind',
        severity: 'warning',
        title: `${p.name} — прошло ${p.timePct}% срока, закрыто ${p.donePct}% задач`,
        subtitle: `${p.doneTasks} из ${p.totalTasks} задач`,
        entityType: 'PROJECT', entityId: p.id,
      });
    }

    const idle = team.filter(m => m.activeTasks === 0).length;

    return {
      generatedAt: now.toISOString(),
      metrics: {
        overdue, unassigned, stale, closedLast24h,
        createdLast24h, totalActive,
        onlineCount: online.length,
        teamCount: users.length,
        idleCount: idle,
      },
      signals,
      team,
      projects: projectProgress,
    };
  }
}

/** Русское склонение: 1 день, 2 дня, 5 дней. */
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
