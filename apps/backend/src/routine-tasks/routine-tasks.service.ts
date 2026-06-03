import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RoutineTasksService {
  constructor(private readonly prisma: PrismaService) {}

  async getTemplates(orgId: string) {
    return this.prisma.routineTask.findMany({
      where: { orgId, deletedAt: null },
      include: { assignee: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTemplate(orgId: string, userId: string, dto: any) {
    return this.prisma.routineTask.create({
      data: {
        orgId,
        title:       dto.title,
        description: dto.description,
        assigneeId:  dto.assigneeId || null,
        priority:    dto.priority   || 'MEDIUM',
        dueTime:     dto.dueTime    || null,
        schedule:    dto.schedule   || 'DAILY',
        daysOfWeek:  dto.daysOfWeek || [],
        isActive:    dto.isActive   !== false,
        startDate:   dto.startDate  || null,
        endDate:     dto.endDate    || null,
        createdById: userId,
      },
      include: { assignee: { select: { id: true, name: true } } },
    });
  }

  async updateTemplate(id: string, orgId: string, dto: any) {
    return this.prisma.routineTask.update({
      where: { id },
      data: {
        title:       dto.title,
        description: dto.description,
        assigneeId:  dto.assigneeId  || null,
        priority:    dto.priority,
        dueTime:     dto.dueTime     || null,
        schedule:    dto.schedule,
        daysOfWeek:  dto.daysOfWeek  || [],
        isActive:    dto.isActive,
        startDate:   dto.startDate   || null,
        endDate:     dto.endDate     || null,
        updatedAt:   new Date(),
      },
      include: { assignee: { select: { id: true, name: true } } },
    });
  }

  async deleteTemplate(id: string, orgId: string) {
    return this.prisma.routineTask.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async toggleActive(id: string, orgId: string) {
    const t = await this.prisma.routineTask.findUnique({ where: { id } });
    if (!t) return null;
    return this.prisma.routineTask.update({
      where: { id },
      data: { isActive: !t.isActive },
    });
  }

  // Called by scheduler — creates tasks for today
  async spawnTasksForToday(orgId: string) {
    const now       = new Date();
    const today     = now.toISOString().slice(0, 10);
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // 1=Пн, 7=Вс

    const templates = await this.prisma.routineTask.findMany({
      where: { orgId, isActive: true, deletedAt: null },
    });

    let created = 0;
    for (const tpl of templates) {
      // Check date range
      if (tpl.startDate && today < tpl.startDate) continue;
      if (tpl.endDate   && today > tpl.endDate)   continue;

      // Check schedule
      if (tpl.schedule === 'WEEKDAYS' && [6, 7].includes(dayOfWeek)) continue;
      if (tpl.schedule === 'CUSTOM' && tpl.daysOfWeek.length > 0 && !tpl.daysOfWeek.includes(dayOfWeek)) continue;

      // Check if already created today
      const exists = await this.prisma.task.findFirst({
        where: {
          orgId,
          title: tpl.title,
          createdAt: { gte: new Date(today + 'T00:00:00'), lte: new Date(today + 'T23:59:59') },
          isRoutine: true,
        } as any,
      });
      if (exists) continue;

      // Calculate due date
      let dueDate: Date | null = null;
      if (tpl.dueTime) {
        const [h, m] = tpl.dueTime.split(':').map(Number);
        dueDate = new Date(today + 'T00:00:00');
        dueDate.setHours(h, m, 0, 0);
      }

      await this.prisma.task.create({
        data: {
          orgId,
          title:       tpl.title + ' — ' + new Date(today).toLocaleDateString('ru', { day: 'numeric', month: 'short' }),
          description: tpl.description,
          assigneeId:  tpl.assigneeId,
          priority:    tpl.priority as any,
          status:      'NEW',
          dueDate,
          createdById: tpl.createdById,
          isRoutine:   true,
        } as any,
      });
      created++;
    }
    return { created, date: today };
  }

  async getStats(orgId: string, days = 7) {
    const from = new Date();
    from.setDate(from.getDate() - days);

    const templates = await this.prisma.routineTask.findMany({
      where: { orgId, deletedAt: null },
      include: { assignee: { select: { id: true, name: true } } },
    });

    const tasks = await this.prisma.task.findMany({
      where: {
        orgId,
        isRoutine: true,
        createdAt: { gte: from },
      } as any,
      include: { assignee: { select: { id: true, name: true } } },
    });

    const total     = tasks.length;
    const done      = tasks.filter((t: any) => t.status === 'DONE').length;
    const overdue   = tasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'DONE').length;
    const pct       = total > 0 ? Math.round(done / total * 100) : 0;

    return { templates: templates.length, total, done, overdue, pct };
  }
}
