import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class KpiService {
  constructor(private readonly prisma: PrismaService) {}

  getPeriod(offset = 0) {
    const d = new Date(); d.setMonth(d.getMonth() + offset);
    return d.toISOString().slice(0, 7);
  }

  async getKpis(orgId: string, period?: string) {
    const p = period ?? this.getPeriod();
    const users = await this.prisma.user.findMany({
      where: { orgId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true, name: true, email: true },
    });
    const kpis = await this.prisma.employeeKpi.findMany({ where: { orgId, period: p } });
    const kpiMap = Object.fromEntries(kpis.map(k => [k.userId, k]));
    const from = new Date(p + '-01T00:00:00.000Z');
    const to   = new Date(from.getFullYear(), from.getMonth() + 1, 0, 23, 59, 59);
    const taskStats = await this.prisma.task.groupBy({
      by: ['assigneeId'], _count: { id: true },
      where: { orgId, completedAt: { gte: from, lte: to }, status: 'DONE', deletedAt: null, assigneeId: { not: null } },
    });
    const taskMap = Object.fromEntries(taskStats.map(t => [t.assigneeId, t._count.id]));
    const actStats = await this.prisma.activityEvent.groupBy({
      by: ['userId'], _count: { id: true },
      where: { orgId, createdAt: { gte: from, lte: to } },
    });
    const clickMap = Object.fromEntries(actStats.map(a => [a.userId, a._count.id]));
    return users.map(u => {
      const kpi = kpiMap[u.id];
      const tasksDone    = (taskMap  as any)[u.id] ?? 0;
      const clicksActual = (clickMap as any)[u.id] ?? 0;
      return {
        userId: u.id, name: u.name, email: u.email, period: p,
        tasksTarget: kpi?.tasksTarget ?? 0, tasksDone,
        clicksTarget: kpi?.clicksTarget ?? 0, clicksActual,
        activeDaysTarget: kpi?.activeDaysTarget ?? 0,
        notes: kpi?.notes ?? '', kpiId: kpi?.id ?? null,
        tasksPct:  kpi?.tasksTarget  ? Math.min(100, Math.round(tasksDone    / kpi.tasksTarget  * 100)) : null,
        clicksPct: kpi?.clicksTarget ? Math.min(100, Math.round(clicksActual / kpi.clicksTarget * 100)) : null,
      };
    });
  }

  async upsertKpi(orgId: string, createdById: string, dto: any) {
    const period = dto.period ?? this.getPeriod();
    return this.prisma.employeeKpi.upsert({
      where:  { orgId_userId_period: { orgId, userId: dto.userId, period } },
      create: { orgId, userId: dto.userId, period, createdById, tasksTarget: dto.tasksTarget ?? 0, clicksTarget: dto.clicksTarget ?? 0, activeDaysTarget: dto.activeDaysTarget ?? 0, notes: dto.notes ?? '' },
      update: { tasksTarget: dto.tasksTarget ?? 0, clicksTarget: dto.clicksTarget ?? 0, activeDaysTarget: dto.activeDaysTarget ?? 0, notes: dto.notes ?? '', updatedAt: new Date() },
    });
  }

  async deleteKpi(id: string, orgId: string) {
    const kpi = await this.prisma.employeeKpi.findFirst({ where: { id, orgId } });
    if (!kpi) throw new NotFoundException('KPI not found');
    return this.prisma.employeeKpi.delete({ where: { id } });
  }
}